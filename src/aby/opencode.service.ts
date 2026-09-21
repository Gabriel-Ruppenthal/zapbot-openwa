import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

@Injectable()
export class OpencodeService {
  private readonly logger = new Logger(OpencodeService.name);

  // lê OPENROUTER_API_KEY do env ou do auth.json do opencode (ecossistema)
  getOpenRouterKey(): string | null {
    if (process.env.OPENROUTER_API_KEY?.startsWith('sk-or-')) return process.env.OPENROUTER_API_KEY;

    const candidates = [
      process.env.OPENROUTER_API_KEY,
      path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json'),
      path.join(os.homedir(), '.config', 'opencode', 'auth.json'),
    ];

    for (const c of candidates) {
      if (!c) continue;
      if (c.startsWith('sk-or-')) return c;
      try {
        const data = JSON.parse(fs.readFileSync(c, 'utf8'));
        const key = data?.openrouter?.key;
        if (typeof key === 'string' && key.startsWith('sk-or-')) {
          this.logger.log(`openrouter key carregada de ${c} via opencode auth`);
          return key;
        }
      } catch {}
    }
    this.logger.warn('OPENROUTER_API_KEY não encontrada - configure no .env ou auth.json do opencode');
    return null;
  }

  getOpenRouterUrl(): string {
    return process.env.OPENROUTER_URL || 'https://openrouter.ai/api/v1/chat/completions';
  }

  getModel(): string {
    return process.env.MODEL || process.env.ABY_MODEL || 'google/gemma-4-31b-it:free';
  }

  // fallback models igual zapbot
  getFallbackModels(): string[] {
    const primary = this.getModel();
    const fallbacks = [
      'nvidia/nemotron-3-super-120b-a12b:free',
      'nvidia/nemotron-3-ultra-550b-a55b:free',
      'google/gemma-4-26b-a4b-it:free',
      'poolside/laguna-s-2.1:free',
    ];
    return [primary, ...fallbacks.filter((m) => m !== primary)];
  }

  // opencode auth também tem openrouter + opencode key + nvidia - loga o que achou
  getOpencodeEcosystem(): Record<string, string | null> {
    try {
      const authPath = path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json');
      if (fs.existsSync(authPath)) {
        const data = JSON.parse(fs.readFileSync(authPath, 'utf8'));
        return {
          openrouter: data?.openrouter?.key ? data.openrouter.key.slice(0, 12) + '...' : null,
          opencode: data?.opencode?.key ? data.opencode.key.slice(0, 12) + '...' : null,
          nvidia: data?.nvidia?.key ? data.nvidia.key.slice(0, 12) + '...' : null,
        };
      }
    } catch {}
    return { openrouter: null, opencode: null, nvidia: null };
  }
}
