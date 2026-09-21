import { Controller, Post, Get, Body, Logger } from '@nestjs/common';
import { AbyService } from './aby.service';

@Controller('aby')
export class AbyController {
  private readonly logger = new Logger(AbyController.name);
  constructor(private readonly aby: AbyService) {}

  @Get('status')
  status() {
    return this.aby.getStatus();
  }

  // webhook que o OpenWA chama quando chega mensagem (configurar webhook no dashboard -> http://localhost:2785/api/aby/webhook)
  // também pode ser chamado direto pelo llm-bridge ou por teste
  @Post('webhook')
  async webhook(@Body() payload: any) {
    this.logger.log(`webhook recebido ${JSON.stringify(payload).slice(0, 300)}`);
    // payload do OpenWA vem com { sessionId, data: { chatId, from, body, type, fromMe, isGroup } }
    // se for teste simples { text, chatId, sessionId }
    const sessionId = payload.sessionId || payload.session || 'default';
    const data = payload.data || payload;
    const chatId = data.chatId || data.chat_id || data.from || 'unknown@c.us';
    const text = data.body || data.text || data.message || '';
    const from = data.from || chatId;

    if (!text?.trim()) return { handled: 'not-eligible', reason: 'no-text' };

    try {
      const out = await this.aby.generate({
        sessionId,
        chatId,
        from,
        text: text.trim(),
        history: payload.history || [],
        perfil: payload.perfil || {},
      });
      // se for via webhook do OpenWA, o ideal é deixar o Automation ou o próprio OpenWA enviar - aqui só retorna o JSON pra quem chamou decidir
      // se serio ou importancia >=75, o dashboard vai pra fila - aqui já vem com flag
      return { handled: 'generated', ...out };
    } catch (e: any) {
      return { handled: 'error', reason: e.message };
    }
  }

  // teste direto: POST /api/aby/generate { text, history, perfil }
  @Post('generate')
  async generate(@Body() body: any) {
    return this.aby.generate({
      sessionId: body.sessionId || 'test',
      chatId: body.chatId || 'test@c.us',
      from: body.from || 'test@c.us',
      text: body.text,
      history: body.history || [],
      perfil: body.perfil || {},
    });
  }
}
