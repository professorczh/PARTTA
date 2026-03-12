import { ProviderConfig, ModelConfig } from '../store';

export interface AIServiceRequest {
  prompt: string;
  images?: { data: string; mimeType: string }[];
  modelId: string;
  provider: ProviderConfig;
  isDemoMode?: boolean;
  aspectRatio?: string;
  imageSize?: string;
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high' | 'off';
  thoughtSignature?: string;
}

export interface AIServiceResponse {
  text?: string;
  imageUrl?: string;
  thoughtSignature?: string;
  error?: string;
  metadata?: {
    modelName?: string;
    resolution?: string;
    duration?: number;
  };
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
    let testModel = provider.models[0]?.id;
    const protocol = provider.defaultProtocol || (provider.type === 'gemini' ? 'gemini' : 'openai-compatible');

    // If no models defined, use a default one for testing based on protocol
    if (!testModel) {
      if (protocol === 'gemini') testModel = 'gemini-1.5-flash';
      else testModel = 'gpt-3.5-turbo';
    }

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

  async urlToBase64(url: string): Promise<string> {
    try {
      // Use proxy to avoid CORS issues
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: url,
          method: 'GET'
        })
      });
      
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Proxy request failed with status ${response.status}`);
      }
      
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error('Failed to convert URL to Base64 (via proxy):', e);
      // Fallback to direct fetch if proxy fails
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (e2) {
        return url;
      }
    }
  },

  async callMock(request: AIServiceRequest): Promise<AIServiceResponse> {
    const { modelId, prompt, aspectRatio, provider } = request;
    const startTime = Date.now();
    
    // Simulate a quick delay (1.0-1.5 seconds) to show off the timer but keep it snappy
    const delay = 1000 + Math.random() * 500;
    await new Promise(resolve => setTimeout(resolve, delay)); 
    
    const duration = (Date.now() - startTime) / 1000;
    const modelConfig = provider.models.find(m => m.id === modelId);
    const modelName = modelConfig?.name || 'Mock Model';

    if (modelId.includes('image') || modelId.includes('video')) {
      let width = 1024;
      let height = 1024;

      if (aspectRatio === '16:9') { width = 1024; height = 576; }
      else if (aspectRatio === '9:16') { width = 576; height = 1024; }
      else if (aspectRatio === '4:3') { width = 1024; height = 768; }
      else if (aspectRatio === '3:4') { width = 768; height = 1024; }
      else if (aspectRatio === '21:9') { width = 1024; height = 438; }

      const resolution = `${width} x ${height}`;
      const imageUrl = `https://picsum.photos/seed/${Math.random()}/${width}/${height}`;
      const base64Image = await this.urlToBase64(imageUrl);
      
      return { 
        imageUrl: base64Image,
        metadata: {
          modelName,
          resolution,
          duration
        }
      };
    }

    return { 
      text: `[SYSTEM MOCK RESPONSE]\n\nYou said: "${prompt}"\n\nThis is a simulated response. To get real AI results, please configure a provider in the Models settings.`,
      metadata: {
        modelName,
        duration
      }
    };
  },

  async callGemini(request: AIServiceRequest): Promise<AIServiceResponse> {
    const { provider, modelId, prompt = "", images, aspectRatio, imageSize, thinkingLevel, thoughtSignature } = request;
    
    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${provider.apiKey}`;
    
    const parts: any[] = [];
    
    // Add text part if prompt is not empty, or if we have no images
    if (prompt.trim() || (images || []).length === 0) {
      parts.push({ text: prompt || " " }); // Use space if empty to satisfy API
    }

    if (images && images.length > 0) {
      parts.push(...images.map(img => ({
        inline_data: {
          mime_type: img.mimeType,
          data: img.data.split(',')[1] || img.data
        }
      })));
    }

    // If we have a thought signature from a previous turn, we must include it
    if (thoughtSignature) {
      parts.unshift({ thoughtSignature });
    }

    const contents = [
      {
        role: "user",
        parts
      }
    ];

    const modelConfig = provider.models.find(m => m.id === modelId);
    const supportsImage = modelConfig?.capabilities.image;

    const hasPins = prompt.includes('[PIN_') && prompt.includes('coordinate: [');
    const systemInstruction = hasPins 
      ? "You are a precise image analysis and editing expert. All coordinates provided in the prompt are normalized to a 1000x1000 grid representing the full visible area of each image, regardless of its original aspect ratio. Coordinate [0,0] represents the top-left corner, and [1000,1000] represents the bottom-right corner. When asked to analyze or edit a specific coordinate, locate it precisely on the corresponding image."
      : undefined;

    const body: any = { 
      contents,
      generationConfig: {},
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined
    };

    if (thinkingLevel && thinkingLevel !== 'off' && modelId.startsWith('gemini-3')) {
      body.generationConfig.thinkingConfig = {
        thinkingLevel: thinkingLevel
      };
    }

    if (supportsImage) {
      body.generationConfig.responseModalities = ["TEXT", "IMAGE"];
      body.generationConfig.imageConfig = {
        aspectRatio: aspectRatio || '1:1',
        imageSize: imageSize || '1K'
      };
    }

    try {
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl,
          method: 'POST',
          body: body
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorMsg = errorJson.error?.message || errorJson.error || errorText;
        } catch (e) {
          // If it's HTML, try to extract a meaningful message
          if (errorText.includes('<body')) {
            const match = errorText.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            if (match) errorMsg = match[1].replace(/<[^>]*>?/gm, '').trim().substring(0, 200);
          }
        }
        return { error: errorMsg || `Request failed with status ${response.status}` };
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        return { error: `Expected JSON but received ${contentType || 'unknown'}. This usually means the proxy or API returned an error page. Content: ${text.substring(0, 100)}` };
      }

      let data: any;
      try {
        data = await response.json();
      } catch (e) {
        return { error: `Failed to parse JSON response. The response might be malformed.` };
      }
      
      if (data.error) {
        return { error: data.error.message || JSON.stringify(data.error) };
      }

      const candidate = data.candidates?.[0];
      const contentParts = candidate?.content?.parts || [];
      
      // Extract text
      const textPart = contentParts.find((p: any) => p.text);
      const text = textPart?.text;

      // Extract thought signature
      const signaturePart = contentParts.find((p: any) => p.thoughtSignature);
      const newSignature = signaturePart?.thoughtSignature;
      
      // Handle Image Generation for Gemini
      const imagePart = contentParts.find((p: any) => p.inlineData || p.inline_data);
      if (imagePart) {
        const img = imagePart.inlineData || imagePart.inline_data;
        const mimeType = img.mimeType || img.mime_type;
        return { 
          imageUrl: `data:${mimeType};base64,${img.data}`,
          thoughtSignature: newSignature 
        };
      }

      return { text, thoughtSignature: newSignature };
    } catch (err: any) {
      return { error: err.message };
    }
  },

  async callOpenAICompatible(request: AIServiceRequest): Promise<AIServiceResponse> {
    const { provider, modelId, prompt = "", images } = request;
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
            max_tokens: 1000
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorMsg = errorJson.error?.message || errorJson.error || errorText;
        } catch (e) {
          // If it's HTML, try to extract a meaningful message
          if (errorText.includes('<body')) {
            const match = errorText.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            if (match) errorMsg = match[1].replace(/<[^>]*>?/gm, '').trim().substring(0, 200);
          }
        }
        return { error: errorMsg || `Request failed with status ${response.status}` };
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        return { error: `Expected JSON but received ${contentType || 'unknown'}. This usually means the proxy or API returned an error page. Content: ${text.substring(0, 100)}` };
      }

      let data: any;
      try {
        data = await response.json();
      } catch (e) {
        return { error: `Failed to parse JSON response. The response might be malformed.` };
      }

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
