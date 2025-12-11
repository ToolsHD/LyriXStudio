
import { LyricsDocument, LyricsFormat, TimedLine, TimedWord } from '../types';

// --- Helpers ---

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const formatTimestamp = (seconds: number, precision: 2 | 3 = 2): string => {
  if (isNaN(seconds) || seconds < 0) return precision === 3 ? '00:00.000' : '00:00.00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = seconds % 1;
  
  const mStr = minutes.toString().padStart(2, '0');
  const sStr = secs.toString().padStart(2, '0');
  
  let msStr = '';
  if (precision === 3) {
      msStr = Math.floor(ms * 1000).toString().padStart(3, '0');
  } else {
      msStr = Math.floor(ms * 100).toString().padStart(2, '0');
  }
  
  const timeBase = hours > 0 
    ? `${hours}:${mStr}:${sStr}` 
    : `${mStr}:${sStr}`;

  return `${timeBase}.${msStr}`;
};

export const parseTimestamp = (timeStr: string): number => {
  if (!timeStr) return 0;
  const cleanStr = timeStr.trim().replace(/[\[\]<>]/g, '');
  const parts = cleanStr.split(':');
  
  try {
      if (parts.length === 3) {
          const h = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          const s = parseFloat(parts[2]);
          return h * 3600 + m * 60 + s;
      }
      
      if (parts.length === 2) {
          const m = parseInt(parts[0], 10);
          const s = parseFloat(parts[1]);
          return m * 60 + s;
      }

      if (!isNaN(parseFloat(cleanStr))) {
          return parseFloat(cleanStr);
      }
  } catch (e) {
      console.warn("Failed to parse timestamp", timeStr);
  }

  return 0;
};

// --- Parsers ---

export const detectFormat = (text: string): LyricsFormat => {
  if (text.includes('<tt') || text.includes('xmlns="http://www.w3.org/ns/ttml"')) return LyricsFormat.TTML;
  if (/<[0-9]{1,2}:[0-9]{2}(?:\.[0-9]{1,3})?>/.test(text)) return LyricsFormat.ELRC; 
  if (/\[[0-9]{1,3}:[0-9]{2}/.test(text)) return LyricsFormat.LRC;
  return LyricsFormat.PLAIN;
};

const parseLRC = (text: string): LyricsDocument => {
  const lines: TimedLine[] = [];
  const metadata: any = {
      title: '', artist: '', album: '', offset: 0, custom: {}
  };
  
  const lineTimeRegex = /\[(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\.(\d{1,3}))?\]/g;
  const metaRegex = /^\[([a-zA-Z0-9-]+):(.*)\]$/;
  
  const rawLines = text.split(/\r?\n/);

  rawLines.forEach(rawLine => {
    let content = rawLine.trim();
    if (!content) return;

    // 1. Metadata Check
    const metaMatch = content.match(metaRegex);
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase().trim();
      const val = metaMatch[2].trim();
      
      if (!/^\d/.test(key)) {
          if (key === 'ti') metadata.title = val;
          else if (key === 'ar') metadata.artist = val;
          else if (key === 'al') metadata.album = val;
          else if (key === 'au') metadata.author = val; // Maps to Author in LRC
          else if (key === 'by') metadata.createdBy = val;
          else if (key === 're') metadata.creator = val;
          else if (key === 've') metadata.version = val;
          else if (key === 'offset') metadata.offset = parseInt(val, 10);
          else if (key === 'la') metadata.language = val; // Non-standard but common
          else metadata.custom[key] = val;
          return;
      }
    }

    // 2. Extract Line Timestamps
    const timestamps: number[] = [];
    
    while (true) {
        const result = lineTimeRegex.exec(content);
        if (result && result.index === 0) {
            let t = 0;
            if (result[3]) { // HH:MM:SS
                const h = parseInt(result[1], 10);
                const m = parseInt(result[2], 10);
                const s = parseInt(result[3], 10);
                const msVal = result[4] || '0';
                const ms = parseFloat('0.' + msVal);
                t = h * 3600 + m * 60 + s + ms;
            } else { // MM:SS
                const m = parseInt(result[1], 10);
                const s = parseInt(result[2], 10);
                const msVal = result[4] || '0';
                const ms = parseFloat('0.' + msVal);
                t = m * 60 + s + ms;
            }
            timestamps.push(t);
            content = content.substring(result[0].length).trim();
            lineTimeRegex.lastIndex = 0;
        } else {
            break;
        }
    }

    if (timestamps.length > 0) {
        const isBackground = content.startsWith('(') && content.endsWith(')');
        
        // Detect Voice
        let voice: string = 'v1'; // Default voice for LRC import
        const voiceMatch = content.match(/^([A-Za-z0-9\s]+):\s+(.*)/);
        if (voiceMatch) {
             voice = voiceMatch[1].trim();
             content = voiceMatch[2].trim();
        }

        const hasWordTimings = /<(\d{1,2}):(\d{1,2})/.test(content);
        
        timestamps.forEach(startTime => {
            const words: TimedWord[] = [];

            if (hasWordTimings) {
                const parts = content.split(/(<[\d:.]+>)/).filter(p => p.trim());
                let currentWordTime = startTime;
                
                parts.forEach(part => {
                    const tagMatch = part.match(/<(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\.(\d{1,3}))?>/);
                    if (tagMatch) {
                        if (tagMatch[3]) { // HH:MM:SS
                             const h = parseInt(tagMatch[1], 10);
                             const m = parseInt(tagMatch[2], 10);
                             const s = parseInt(tagMatch[3], 10);
                             const ms = tagMatch[4] ? parseFloat('0.' + tagMatch[4]) : 0;
                             currentWordTime = h * 3600 + m * 60 + s + ms;
                        } else { // MM:SS
                             const m = parseInt(tagMatch[1], 10);
                             const s = parseInt(tagMatch[2], 10);
                             const ms = tagMatch[4] ? parseFloat('0.' + tagMatch[4]) : 0;
                             currentWordTime = m * 60 + s + ms;
                        }
                    } else {
                        const wText = part.trim();
                        if (wText) {
                            words.push({
                                id: generateId(),
                                text: wText,
                                startTime: currentWordTime
                            });
                        }
                    }
                });
            } else {
                const plainWords = content.split(/\s+/).filter(Boolean);
                plainWords.forEach(w => {
                    words.push({
                        id: generateId(),
                        text: w,
                        startTime: startTime
                    });
                });
            }
            
            const rawTextClean = words.map(w => w.text).join(' ');

            lines.push({
                id: generateId(),
                startTime,
                words,
                rawText: rawTextClean || content,
                voice,
                isBackground
            });
        });
    }
  });

  lines.sort((a, b) => a.startTime - b.startTime);

  // Infer end times
  for (let i = 0; i < lines.length; i++) {
    if (i < lines.length - 1) {
      lines[i].endTime = lines[i + 1].startTime;
    } else {
      lines[i].endTime = lines[i].startTime + 5; // Default duration for last line
    }
    
    const lineWords = lines[i].words;
    for (let j = 0; j < lineWords.length; j++) {
        if (j < lineWords.length - 1) {
            lineWords[j].endTime = lineWords[j+1].startTime;
        } else {
            lineWords[j].endTime = lines[i].endTime;
        }
    }
  }

  // Populate songwriters if author is present but songwriters is not
  if (metadata.author && !metadata.songwriters) {
      metadata.songwriters = metadata.author.split(',').map((s:string) => s.trim());
  }

  return { format: LyricsFormat.LRC, lines, metadata };
};

const parseELRC = (text: string): LyricsDocument => {
  const base = parseLRC(text);
  base.format = LyricsFormat.ELRC;
  return base;
};

const parseTTML = (text: string): LyricsDocument => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, "text/xml");
  
  const lines: TimedLine[] = [];
  const metadata: any = { title: '', artist: '', album: '', songwriters: [], custom: {} };
  
  // Namespaces
  const ns = {
      ttm: "http://www.w3.org/ns/ttml#metadata",
      itunes: "http://music.apple.com/lyric-ttml-internal",
      tt: "http://www.w3.org/ns/ttml"
  };

  // Helper to get attributes with or without namespace (for robustness)
  const getAttr = (el: Element, name: string, nsUrl?: string) => {
      if (nsUrl && el.hasAttributeNS(nsUrl, name)) return el.getAttributeNS(nsUrl, name);
      if (el.hasAttribute(name)) return el.getAttribute(name);
      // Try prefix check
      const parts = name.split(':');
      if (parts.length > 1) {
          // try finding attribute that ends with :name or strictly matches
          for (let i=0; i<el.attributes.length; i++) {
              const attr = el.attributes[i];
              if (attr.name === name || attr.localName === parts[1]) return attr.value;
          }
      }
      return null;
  };

  // --- Metadata Parsing ---
  const head = xmlDoc.getElementsByTagName("head")[0];
  const agentMap = new Map<string, string>(); // xml:id -> name

  if (head) {
      // Language
      const lang = xmlDoc.documentElement.getAttribute("xml:lang");
      if (lang) metadata.language = lang;

      // Agents
      const agents = head.getElementsByTagNameNS(ns.ttm, "agent");
      const allAgents = agents.length > 0 ? agents : head.getElementsByTagName("ttm:agent");
      
      Array.from(allAgents).forEach(agent => {
          const id = agent.getAttribute("xml:id");
          const nameTag = agent.getElementsByTagNameNS(ns.ttm, "name")[0] || agent.getElementsByTagName("ttm:name")[0];
          
          if (id) {
              if (nameTag && nameTag.textContent) {
                  agentMap.set(id, nameTag.textContent);
              } else {
                  // If no name, use ID as name (fallback)
                  agentMap.set(id, id);
              }
          }
      });

      // Title/Artist/Album
      const getMeta = (tagName: string) => {
          // try ns, try ttm prefix, try plain
          const t1 = head.getElementsByTagNameNS(ns.ttm, tagName)[0];
          if (t1) return t1.textContent;
          const t2 = head.getElementsByTagName("ttm:"+tagName)[0];
          if (t2) return t2.textContent;
          const t3 = head.getElementsByTagName(tagName)[0]; // Fallback (standard metadata)
          if (t3) return t3.textContent;
          return null;
      };

      const title = getMeta("title");
      if (title) metadata.title = title;
      
      const artist = getMeta("artist");
      if (artist) metadata.artist = artist;

      // iTunes Metadata (Songwriters)
      const itunesMeta = head.getElementsByTagName("iTunesMetadata")[0] || head.getElementsByTagNameNS(ns.itunes, "iTunesMetadata")[0] || head.getElementsByTagName("itunes:iTunesMetadata")[0];
      if (itunesMeta) {
          const swContainer = itunesMeta.getElementsByTagName("songwriters")[0] || itunesMeta.getElementsByTagNameNS(ns.itunes, "songwriters")[0];
          if (swContainer) {
              const sws = swContainer.getElementsByTagName("songwriter");
              const names: string[] = [];
              Array.from(sws).forEach(sw => { if(sw.textContent) names.push(sw.textContent) });
              metadata.songwriters = names;
          }
      }
  }

  // --- Body Parsing ---
  const body = xmlDoc.getElementsByTagName("body")[0];
  if (!body) return { format: LyricsFormat.TTML, lines: [], metadata };

  const parseTime = (t: string | null): number | undefined => {
    if (!t) return undefined;
    if (t.includes(':')) return parseTimestamp(t);
    if (t.endsWith('ms')) return parseFloat(t) / 1000;
    if (t.endsWith('s')) return parseFloat(t);
    const parsed = parseFloat(t);
    return isNaN(parsed) ? undefined : parsed;
  };

  const divs = body.getElementsByTagName("div");
  const containers = divs.length > 0 ? Array.from(divs) : [body];

  containers.forEach((container: Element) => {
      const ps = container.getElementsByTagName("p");
      Array.from(ps).forEach((p: Element) => {
          const pBegin = getAttr(p, "begin");
          const pEnd = getAttr(p, "end");
          const pStart = parseTime(pBegin) || 0;
          const pEndTime = parseTime(pEnd);
          
          let voiceId = getAttr(p, "agent", ns.ttm) || getAttr(p, "ttm:agent") || getAttr(p, "role", ns.ttm) || getAttr(p, "ttm:role");
          let voice = voiceId ? (agentMap.get(voiceId) || voiceId) : undefined;

          // Capture Attributes (e.g., itunes:key)
          const attributes: Record<string, string> = {};
          Array.from(p.attributes).forEach(attr => {
              // Grab all itunes: prefixed attributes or generic 'key'
              if (attr.name.startsWith('itunes:') || attr.name === 'key') {
                  attributes[attr.name] = attr.value;
              }
          });

          const pRole = getAttr(p, "role", ns.ttm) || getAttr(p, "ttm:role");
          const isLineBg = pRole === 'x-bg' || p.getAttribute("style")?.includes("bg") || p.textContent?.trim().startsWith('(') || false;

          const words: TimedWord[] = [];
          
          // Recursive traversal to handle nested spans and x-bg inheritance
          const traverse = (node: Node, currentBg: boolean, currentStartTime: number) => {
              if (node.nodeType === Node.TEXT_NODE) {
                  const text = node.textContent?.trim();
                  if (text) {
                      // Text node generally inherits time from parent span if present
                      words.push({
                          id: generateId(),
                          text,
                          startTime: currentStartTime,
                          isBackground: currentBg
                      });
                  }
              } else if (node.nodeType === Node.ELEMENT_NODE) {
                  const el = node as Element;
                  if (el.tagName.toLowerCase() === 'br') return;

                  const begin = getAttr(el, "begin");
                  const end = getAttr(el, "end");
                  const role = getAttr(el, "role", ns.ttm) || getAttr(el, "ttm:role");
                  
                  const startTime = parseTime(begin);
                  const endTime = parseTime(end);
                  
                  // Check for background vocal role in this span
                  const isBg = currentBg || role === 'x-bg';
                  const effectiveStart = startTime !== undefined ? startTime : currentStartTime;

                  // Recurse into children
                  Array.from(node.childNodes).forEach(child => {
                      traverse(child, isBg, effectiveStart);
                  });

                  // If explicit end time exists on this span, try to apply it to words contained within
                  if (endTime !== undefined) {
                       // Heuristic: Apply end time to the last added word if it matches start time criteria
                      for (let i = words.length - 1; i >= 0; i--) {
                          if (words[i].startTime >= effectiveStart && words[i].endTime === undefined) {
                              words[i].endTime = endTime;
                          } else {
                              break; 
                          }
                      }
                  }
              }
          };

          Array.from(p.childNodes).forEach(child => traverse(child, isLineBg, pStart));

          const rawText = words.map(w => w.text).join(' ');

          if (words.length > 0 || rawText) {
             lines.push({
                 id: generateId(),
                 startTime: pStart,
                 endTime: pEndTime,
                 words,
                 rawText: rawText || "",
                 voice,
                 isBackground: isLineBg, // Line-level fallback
                 attributes
             });
          }
      });
  });
  
  lines.sort((a,b) => a.startTime - b.startTime);

  return { format: LyricsFormat.TTML, lines, metadata };
};

export const parseLyrics = (text: string, format?: LyricsFormat): LyricsDocument => {
  const detected = format || detectFormat(text);
  switch (detected) {
    case LyricsFormat.LRC: return parseLRC(text);
    case LyricsFormat.ELRC: return parseELRC(text);
    case LyricsFormat.TTML: return parseTTML(text);
    default:
      const lines = text.split(/\r?\n/).filter(l => l.trim()).map((l, i) => ({
        id: generateId(),
        startTime: 0, 
        words: l.trim().split(/\s+/).map(w => ({ id: generateId(), text: w, startTime: 0 })),
        rawText: l.trim(),
        voice: 'v1'
      }));
      return { format: LyricsFormat.PLAIN, lines, metadata: { title: '', artist: '', album: '', custom: {} } };
  }
};

// --- Generators ---

export const generateLRC = (doc: LyricsDocument): string => {
  let output = '';
  const m = doc.metadata;
  if (m.title) output += `[ti:${m.title}]\n`;
  if (m.artist) output += `[ar:${m.artist}]\n`;
  if (m.album) output += `[al:${m.album}]\n`;
  
  // Use Author field or fallback to Songwriters
  const author = m.author || (m.songwriters ? m.songwriters.join(', ') : '');
  if (author) output += `[au:${author}]\n`;
  
  if (m.createdBy) output += `[by:${m.createdBy}]\n`;
  if (m.offset) output += `[offset:${m.offset}]\n`;
  if (m.language) output += `[la:${m.language}]\n`;
  if (m.custom) {
      Object.entries(m.custom).forEach(([k, v]) => output += `[${k}:${v}]\n`);
  }
  
  doc.lines.forEach(line => {
    output += `[${formatTimestamp(line.startTime, 2)}]${line.rawText}\n`;
  });
  return output;
};

export const generateELRC = (doc: LyricsDocument): string => {
  let output = '';
  const m = doc.metadata;
  if (m.title) output += `[ti:${m.title}]\n`;
  if (m.artist) output += `[ar:${m.artist}]\n`;
  if (m.album) output += `[al:${m.album}]\n`;
  
  doc.lines.forEach(line => {
    output += `[${formatTimestamp(line.startTime, 2)}]`;
    line.words.forEach(w => {
        output += ` <${formatTimestamp(w.startTime, 2)}>${w.text}`;
    });
    output += '\n';
  });
  return output;
};

export const generateTTML = (doc: LyricsDocument): string => {
  // Collect Agents
  const voices = Array.from(new Set(doc.lines.map(l => l.voice || 'v1')));
  const agentMap = new Map<string, string>(); // name -> id
  voices.forEach((v, i) => agentMap.set(v, `v${i+1}`));

  // Check for word synchronization to determine timing mode
  const hasWordSync = doc.lines.some(l => 
    l.words.length > 1 && 
    l.words.some(w => w.startTime > l.startTime + 0.05)
  );
  const timingMode = hasWordSync ? "Word" : "Line";
  
  // Prepare Songwriters
  const songwriters = doc.metadata.songwriters || (doc.metadata.author ? doc.metadata.author.split(',').map(s => s.trim()) : []);

  let output = `<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" 
    xmlns:itunes="http://music.apple.com/lyric-ttml-internal" 
    xmlns:ttm="http://www.w3.org/ns/ttml#metadata" 
    xmlns:tts="http://www.w3.org/ns/ttml#styling"
    itunes:timing="${timingMode}"
    xml:lang="${doc.metadata.language || 'en'}">
  <head>
    <metadata>
      ${doc.metadata.title ? `<title>${doc.metadata.title}</title>` : ''}
      ${doc.metadata.artist ? `<ttm:agent type="person" xml:id="artist"><ttm:name type="full">${doc.metadata.artist}</ttm:name></ttm:agent>` : ''}
      ${voices.map(v => `
      <ttm:agent type="person" xml:id="${agentMap.get(v)}">
        <ttm:name type="full">${v}</ttm:name>
      </ttm:agent>`).join('')}
      <iTunesMetadata>
         <songwriters>
            ${songwriters.map(s => `<songwriter>${s}</songwriter>`).join('\n            ')}
         </songwriters>
      </iTunesMetadata>
    </metadata>
    <styling>
      <style xml:id="default" tts:color="#FFFFFF" tts:fontSize="32px" tts:fontFamily="sans-serif" />
    </styling>
    <layout>
      <region xml:id="bottom" tts:textAlign="center" tts:displayAlign="after" />
    </layout>
  </head>
  <body region="bottom">
    <div itunes:songPart="Verse">
`;

  doc.lines.forEach((line, i) => {
    const begin = formatTimestamp(line.startTime, 3);
    const end = line.endTime ? formatTimestamp(line.endTime, 3) : formatTimestamp(doc.lines[i+1]?.startTime || line.startTime + 5, 3);
    const agentId = agentMap.get(line.voice || 'v1') || 'v1';
    
    // Reconstruct attributes
    let attrStr = '';
    if (line.attributes) {
        Object.entries(line.attributes).forEach(([k,v]) => attrStr += ` ${k}="${v}"`);
    } else {
        attrStr = ` itunes:key="L${i+1}"`;
    }

    output += `      <p begin="${begin}" end="${end}" ttm:agent="${agentId}"${attrStr}>\n`;
    
    line.words.forEach(w => {
        const wStart = formatTimestamp(w.startTime, 3);
        const wEnd = w.endTime ? formatTimestamp(w.endTime, 3) : formatTimestamp(w.startTime + 0.5, 3);
        const bgRole = w.isBackground ? ' ttm:role="x-bg"' : '';
        output += `        <span begin="${wStart}" end="${wEnd}"${bgRole}>${w.text}</span>\n`;
    });

    output += `      </p>\n`;
  });

  output += `    </div>
  </body>
</tt>`;
  return output;
};

export const shiftTimestamps = (doc: LyricsDocument, offsetSeconds: number): LyricsDocument => {
  const newLines = doc.lines.map(line => ({
    ...line,
    startTime: Math.max(0, line.startTime + offsetSeconds),
    endTime: line.endTime ? Math.max(0, line.endTime + offsetSeconds) : undefined,
    words: line.words.map(w => ({
      ...w,
      startTime: Math.max(0, w.startTime + offsetSeconds),
      endTime: w.endTime ? Math.max(0, w.endTime + offsetSeconds) : undefined
    }))
  }));
  return { ...doc, lines: newLines };
};
