import { Injectable, Logger } from '@nestjs/common';
import { PersonaService } from './persona.service';
import { OpencodeService } from './opencode.service';

export interface AbyBrainInput {
  sessionId: string;
  chatId: string;
  from: string;
  text: string;
  history: Array<{ direcao: 'in' | 'out'; texto: string }>;
  perfil?: { nome?: string; personalidade?: string; afetividade?: number };
}

export interface AbyBrainOutput {
  importancia: number;
  serio: boolean;
  responder: boolean;
  motivo: string;
  resposta: string;
  perfil: { nome: string; personalidade: string; afetividadeDelta: number; temas: string[] };
}

@Injectable()
export class AbyService {
  private readonly logger = new Logger(AbyService.name);

  constructor(
    private readonly persona: PersonaService,
    private readonly opencode: OpencodeService,
  ) {}

  private extrairJson(texto: string): any | null {
    const m = texto.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      const limpo = m[0].replace(/,\s*([}\]])/g, '$1');
      try {
        return JSON.parse(limpo);
      } catch {
        return null;
      }
    }
  }

  async generate(input: AbyBrainInput): Promise<AbyBrainOutput> {
    const SYS = this.persona.load();
    const key = this.opencode.getOpenRouterKey();
    if (!key) throw new Error('OPENROUTER_API_KEY não encontrada - configure .env ou auth.json do opencode');

    const user = [
      `perfil da pessoa: ${JSON.stringify(input.perfil || {})}`,
      `afetividade atual: ${input.perfil?.afetividade ?? 50}/100`,
      `histórico recente:`,
      input.history.length ? input.history.map((h) => `${h.direcao === 'in' ? 'pessoa' : 'dono'}: ${h.texto}`).join('\n') : '(sem histórico)',
      ``,
      `mensagem nova: ${input.text}`,
    ].join('\n');

    const modelos = this.opencode.getFallbackModels();
    let ultimoErro: string | null = null;

    for (const model of modelos) {
      try {
        const res = await fetch(this.opencode.getOpenRouterUrl(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
            'HTTP-Referer': 'http://localhost:2785',
            'X-Title': 'zapbot-openwa-aby',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: SYS },
              { role: 'user', content: user },
            ],
            temperature: 0.7,
            max_tokens: 700,
          }),
        });

        if (!res.ok) {
          const err = await res.text().catch(() => '');
          ultimoErro = `openrouter ${res.status} ${model}: ${err.slice(0, 200)}`;
          this.logger.warn(ultimoErro);
          continue;
        }

        const data = (await res.json()) as any;
        const content = data.choices?.[0]?.message?.content || '';
        const parsed = this.extrairJson(content);
        if (!parsed) throw new Error(`resposta não veio em JSON: ${content.slice(0, 200)}`);

        const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Number(v) || 0));

        const out: AbyBrainOutput = {
          importancia: clamp(parsed.importancia, 0, 100),
          serio: Boolean(parsed.serio),
          responder: Boolean(parsed.responder),
          motivo: String(parsed.motivo || ''),
          resposta: String(parsed.resposta || '').trim(),
          perfil: {
            nome: String(parsed.perfil?.nome || '').slice(0, 60),
            personalidade: String(parsed.perfil?.personalidade || '').slice(0, 300),
            afetividadeDelta: clamp(parsed.perfil?.afetividade_delta, -20, 20),
            temas: Array.isArray(parsed.perfil?.temas) ? parsed.perfil.temas.slice(0, 5).map(String) : [],
          },
        };
        this.logger.log(`aby brain ${model} -> importancia ${out.importancia} serio=${out.serio} responder=${out.responder} motivo=${out.motivo}`);
        return out;
      } catch (e: any) {
        ultimoErro = e.message;
        this.logger.warn(`falha ${model}: ${ultimoErro}`);
      }
    }
    throw new Error(`todos os modelos falharam: ${ultimoErro}`);
  }

  getStatus() {
    const eco = this.opencode.getOpencodeEcosystem();
    return {
      personaLen: this.persona.load().length,
      model: this.opencode.getModel(),
      fallbacks: this.opencode.getFallbackModels(),
      openrouterUrl: this.opencode.getOpenRouterUrl(),
      opencodeEcosystem: eco,
      connected: !!this.opencode.getOpenRouterKey(),
    };
  }
}
