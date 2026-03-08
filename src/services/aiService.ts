import { ProviderConfig, ModelConfig } from '../store';

export interface AIServiceRequest {
  prompt: string;
  images?: { data: string; mimeType: string }[];
  modelId: string;
  provider: ProviderConfig;
  isDemoMode?: boolean;
  aspectRatio?: string;
  imageSize?: string;
}

export interface AIServiceResponse {
  text?: string;
  imageUrl?: string;
  error?: string;
}

export const aiService = {
  async generate(request: AIServiceRequest): Promise<AIServiceResponse> {
    const { provider, modelId, isDemoMode } = request;

    if (isDemoMode || provider.type === 'mock') {
      return this.callMock(request);
    }

    if (!provider.apiKey) {
      return { error: `API Key missing for provider: ${provider.name}` };
    }

    // Find the specific model config to check for per-model protocol override
    const modelConfig = provider.models.find(m => m.id === modelId);
    const effectiveProtocol = modelConfig?.protocol || provider.defaultProtocol || (provider.type === 'gemini' ? 'gemini' : 'openai-compatible');

    if (effectiveProtocol === 'gemini') {
      return this.callGemini(request);
    } else {
      return this.callOpenAICompatible(request);
    }
  },

  async testConnection(provider: ProviderConfig): Promise<boolean> {
    if (provider.type === 'mock') return true;
    if (!provider.apiKey) return false;
    
    // Try to call a simple completion to test the key
    const testModel = provider.models[0]?.id;
    if (!testModel) return false;

    const modelConfig = provider.models[0];
    const protocol = modelConfig?.protocol || provider.defaultProtocol || (provider.type === 'gemini' ? 'gemini' : 'openai-compatible');

    try {
      if (protocol === 'gemini') {
        const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${provider.apiKey}`;
        const response = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUrl,
            method: 'POST',
            body: { contents: [{ parts: [{ text: 'hi' }] }] }
          })
        });
        return response.ok;
      } else {
        const baseUrl = provider.baseUrl || 'https://api.openai.com/v1';
        const targetUrl = `${baseUrl}/chat/completions`;
        const response = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUrl,
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${provider.apiKey}`,
              'Content-Type': 'application/json'
            },
            body: {
              model: testModel,
              messages: [{ role: 'user', content: 'hi' }],
              max_tokens: 5
            }
          })
        });
        return response.ok;
      }
    } catch (e) {
      console.error('Connection test failed:', e);
      return false;
    }
  },

  async callMock(request: AIServiceRequest): Promise<AIServiceResponse> {
    const { modelId, prompt, aspectRatio } = request;
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay

    if (modelId.includes('image') || modelId.includes('video')) {
      let width = 1024;
      let height = 1024;

      if (aspectRatio === '16:9') { width = 1024; height = 576; }
      else if (aspectRatio === '9:16') { width = 576; height = 1024; }
      else if (aspectRatio === '4:3') { width = 1024; height = 768; }
      else if (aspectRatio === '3:4') { width = 768; height = 1024; }
      else if (aspectRatio === '21:9') { width = 1024; height = 438; }

      // Return a random image for both image and video mocks
      return { imageUrl: `https://picsum.photos/seed/${Math.random()}/${width}/${height}` };
    }

    return { 
      text: `[SYSTEM MOCK RESPONSE]\n\nYou said: "${prompt}"\n\nThis is a simulated response. To get real AI results, please configure a provider in the Models settings.` 
    };
  },

  async callGemini(request: AIServiceRequest): Promise<AIServiceResponse> {
    const { provider, modelId, prompt, images, aspectRatio, imageSize } = request;
    
    // For Gemini, we use the proxy to avoid CORS and keep it consistent
    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${provider.apiKey}`;
    
    const contents = [
      {
        role: "user",
        parts: [
          { text: prompt },
          ...(images || []).map(img => ({
            inline_data: {
              mime_type: img.mimeType,
              data: img.data.split(',')[1] || img.data
            }
          }))
        ]
      }
    ];

    const body: any = { 
      contents,
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: aspectRatio || '1:1',
          imageSize: imageSize || '1K'
        }
      }
    };

    try {
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl,
          method: 'POST',
          body
        })
      });

      const data = await response.json();
      
      if (data.error) {
        return { error: data.error.message || JSON.stringify(data.error) };
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      // Handle Image Generation for Gemini
      const imagePart = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData || p.inline_data);
      if (imagePart) {
        const img = imagePart.inlineData || imagePart.inline_data;
        const mimeType = img.mimeType || img.mime_type;
        return { imageUrl: `data:${mimeType};base64,${img.data}` };
      }

      return { text };
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async callOpenAICompatible(request: AIServiceRequest): Promise<AIServiceResponse> {
    const { provider, modelId, prompt, images } = request;
    const baseUrl = provider.baseUrl || 'https://api.openai.com/v1';
    const targetUrl = `${baseUrl}/chat/completions`;

    // Adapter: Convert to OpenAI format
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...(images || []).map(img => ({
            type: 'image_url',
            image_url: {
              url: img.data.startsWith('data:') ? img.data : `data:${img.mimeType};base64,${img.data}`
            }
          }))
        ]
      }
    ];

    try {
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${provider.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: {
            model: modelId,
            messages,
            // Add some defaults
            max_tokens: 1000
          }
        })
      });

      const data = await response.json();

      if (data.error) {
        return { error: data.error.message || JSON.stringify(data.error) };
      }

      const text = data.choices?.[0]?.message?.content;
      return { text };
    } catch (err: any) {
      return { error: err.message };
    }
  }
};
