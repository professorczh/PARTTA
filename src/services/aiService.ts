import { ProviderConfig, ModelConfig } from '../store';

export interface AIServiceRequest {
  prompt: string;
  images?: { data: string; mimeType: string }[];
  modelId: string;
  provider: ProviderConfig;
  isGlobalMock?: boolean;
}

export interface AIServiceResponse {
  text?: string;
  imageUrl?: string;
  error?: string;
}

export const aiService = {
  async generate(request: AIServiceRequest): Promise<AIServiceResponse> {
    const { provider, modelId, prompt, images, isGlobalMock } = request;

    if (isGlobalMock || provider.type === 'mock') {
      return this.callMock(request);
    }

    if (!provider.apiKey) {
      return { error: `API Key missing for provider: ${provider.name}` };
    }

    if (provider.type === 'gemini') {
      return this.callGemini(request);
    } else {
      // 12AI / OpenAI Compatible
      // Auto-detect protocol based on model ID
      if (modelId.toLowerCase().includes('gemini')) {
        return this.callGemini(request);
      }
      return this.callOpenAICompatible(request);
    }
  },

  async callMock(request: AIServiceRequest): Promise<AIServiceResponse> {
    const { modelId, prompt } = request;
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay

    if (modelId === 'mock-image') {
      return { imageUrl: `https://picsum.photos/seed/${Math.random()}/1024/1024` };
    }

    return { 
      text: `[SYSTEM MOCK RESPONSE]\n\nYou said: "${prompt}"\n\nThis is a simulated response. To get real AI results, please configure a provider in the Models settings.` 
    };
  },

  async callGemini(request: AIServiceRequest): Promise<AIServiceResponse> {
    const { provider, modelId, prompt, images } = request;
    
    // For Gemini, we use the proxy to avoid CORS and keep it consistent
    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${provider.apiKey}`;
    
    const contents = {
      parts: [
        { text: prompt },
        ...(images || []).map(img => ({
          inlineData: {
            mimeType: img.mimeType,
            data: img.data.split(',')[1] || img.data // Handle data URL or raw base64
          }
        }))
      ]
    };

    try {
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl,
          method: 'POST',
          body: { contents }
        })
      });

      const data = await response.json();
      
      if (data.error) {
        return { error: data.error.message || JSON.stringify(data.error) };
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      // Handle Image Generation for Gemini (if applicable via specific models)
      // Note: gemini-2.5-flash-image might return image parts
      const imagePart = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
      if (imagePart) {
        return { imageUrl: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}` };
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
