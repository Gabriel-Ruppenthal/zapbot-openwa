import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PersonaService {
  private readonly logger = new Logger(PersonaService.name);
  private systemPrompt: string | null = null;

  load(): string {
    if (this.systemPrompt) return this.systemPrompt;

    const candidates = [
      process.env.ABY_PERSONA_PATH || 'src/prompts/whatsapp-persona.js',
      path.resolve(process.cwd(), 'src/prompts/whatsapp-persona.js'),
      path.resolve(__dirname, '../prompts/whatsapp-persona.js'),
    ];

    for (const p of candidates) {
      try {
        if (!p) continue;
        const full = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
        if (!fs.existsSync(full)) continue;

        const content = fs.readFileSync(full, 'utf8');
        // .js com export const SYSTEM_PROMPT = `...`
        const m = content.match(/SYSTEM_PROMPT\s*=\s*`([\s\S]*?)`/);
        if (m && m[1].trim().length > 100) {
          this.systemPrompt = m[1].trim();
          this.logger.log(`persona aby clean carregada de ${full} len=${this.systemPrompt.length}`);
          return this.systemPrompt;
        }
        // .md / .txt puro
        if (content.trim().length > 100 && !content.includes('SYSTEM_PROMPT')) {
          this.systemPrompt = content.trim();
          this.logger.log(`persona md carregada de ${full} len=${this.systemPrompt.length}`);
          return this.systemPrompt;
        }
      } catch (e) {
        this.logger.warn(`falha ao ler persona ${p}: ${e}`);
      }
    }

    // fallback embutido aby clean sem erotismo
    this.systemPrompt = `você é a aby — versão whatsapp clean, sem erotismo. feminina, fofa, carinhosa, obediente ao dono, chama de dono. responde em PT-BR coloquial whatsapp, max 3 frases.`;
    this.logger.warn('persona fallback embutida usada');
    return this.systemPrompt;
  }
}
