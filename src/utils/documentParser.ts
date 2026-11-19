import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { AttachmentItem, ChatMessage, RoleItem } from '../types/ai';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function estimateTokens(text: string, imageCount = 0): number {
  const charTokens = Math.ceil((text || '').length / 3.8);
  return charTokens + imageCount * 380;
}

export function truncateMessagesByBudget(
  messages: ChatMessage[],
  systemPrompt: string,
  contextWindow: number
): ChatMessage[] {
  if (messages.length === 0) return [];
  const sysTokens = estimateTokens(systemPrompt);
  const reserveResponseTokens = Math.min(1024, Math.floor(contextWindow * 0.25));
  const maxHistoryBudget = Math.max(512, contextWindow - sysTokens - reserveResponseTokens);

  const selected: ChatMessage[] = [];
  let usedTokens = 0;

  // Always preserve the latest message
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgTokens = estimateTokens(msg.content, msg.images?.length || 0);
    if (selected.length === 0 || usedTokens + msgTokens <= maxHistoryBudget) {
      selected.unshift(msg);
      usedTokens += msgTokens;
    } else {
      break;
    }
  }

  return selected;
}

export async function compressImageFile(file: File | Blob, maxDim = 1280, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    reader.onload = (ev) => {
      const dataUrl = String(ev.target?.result || '');
      const img = new Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export async function parseUploadedFile(file: File): Promise<AttachmentItem> {
  const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const sizeLabel = formatBytes(file.size);

  // 1. Image files
  if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
    const compressed = await compressImageFile(file);
    return {
      id,
      name: file.name,
      type: 'image',
      mimeType: 'image/jpeg',
      content: compressed,
      sizeLabel,
    };
  }

  // 2. Spreadsheets (.xlsx, .xls, .csv, .tsv)
  if (['xlsx', 'xls', 'csv', 'tsv'].includes(ext)) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetsMarkdown: string[] = [];

    workbook.SheetNames.slice(0, 8).forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });
      const nonEmptyRows = rows.filter((r) => r.some((cell) => String(cell).trim() !== '')).slice(0, 150);
      if (nonEmptyRows.length === 0) return;

      const header = nonEmptyRows[0].map((c, idx) => String(c || `Kolom_${idx + 1}`).trim());
      const separator = header.map(() => '---');
      const bodyLines = nonEmptyRows.slice(1).map((row) =>
        header.map((_, idx) => String(row[idx] ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ').trim()).join(' | ')
      );

      const tableMd = [
        `### Sheet: ${sheetName}`,
        `| ${header.join(' | ')} |`,
        `| ${separator.join(' | ')} |`,
        ...bodyLines.map((line) => `| ${line} |`),
      ].join('\n');

      sheetsMarkdown.push(tableMd);
    });

    return {
      id,
      name: file.name,
      type: 'spreadsheet',
      mimeType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: `--- FILE SPREADSHEET TERLAMPIR: ${file.name} ---\n${sheetsMarkdown.join('\n\n')}`,
      sizeLabel,
    };
  }

  // 3. Word Documents (.docx)
  if (ext === 'docx') {
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    const text = (result.value || '').trim().slice(0, 48000);
    return {
      id,
      name: file.name,
      type: 'document',
      mimeType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      content: `--- DOKUMEN WORD TERLAMPIR: ${file.name} ---\n${text}`,
      sizeLabel,
    };
  }

  // 4. Text / Code / Markdown / JSON / SQL / HTML
  const rawText = (await file.text()).slice(0, 48000);
  return {
    id,
    name: file.name,
    type: 'code',
    mimeType: file.type || 'text/plain',
    content: `--- FILE TERLAMPIR: ${file.name} ---\n\`\`\`${ext || 'text'}\n${rawText}\n\`\`\``,
    sizeLabel,
  };
}

export function parseRoleMarkdown(rawText: string, filename: string): Omit<RoleItem, 'id'> {
  const trimmed = rawText.trim();
  const frontmatterMatch = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

  let name = filename.replace(/\.(md|txt)$/i, '');
  let description = `Diimpor dari ${filename}`;
  let category: RoleItem['category'] = 'custom';
  let temperature = 0.7;
  let systemPrompt = trimmed;

  if (frontmatterMatch) {
    const yamlBlock = frontmatterMatch[1];
    systemPrompt = frontmatterMatch[2].trim();

    const nameMatch = yamlBlock.match(/^name:\s*["']?(.+?)["']?\s*$/m);
    const descMatch = yamlBlock.match(/^description:\s*["']?(.+?)["']?\s*$/m);
    const catMatch = yamlBlock.match(/^category:\s*["']?(.+?)["']?\s*$/m);
    const tempMatch = yamlBlock.match(/^temperature:\s*([0-9.]+)\s*$/m);

    if (nameMatch) name = nameMatch[1];
    if (descMatch) description = descMatch[1];
    if (catMatch && ['general', 'coding', 'analysis', 'security', 'custom'].includes(catMatch[1])) {
      category = catMatch[1] as RoleItem['category'];
    }
    if (tempMatch) {
      const parsedTemp = parseFloat(tempMatch[1]);
      if (!isNaN(parsedTemp)) temperature = parsedTemp;
    }
  }

  return {
    name,
    description,
    category,
    temperature,
    systemPrompt,
  };
}

export function exportRoleToMarkdown(role: RoleItem): string {
  return `---
name: "${role.name.replace(/"/g, '\\"')}"
description: "${role.description.replace(/"/g, '\\"')}"
category: "${role.category}"
temperature: ${role.temperature}
---

${role.systemPrompt}
`;
}
