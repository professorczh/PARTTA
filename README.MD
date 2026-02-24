# PARTTA

**PARTTA** (formerly TapArt) is an AI-native creative canvas designed for multi-model orchestration. It provides an infinite, node-based workspace where users can chain different AI models (Text, Image, Video) to create complex creative workflows.

## 🚀 Core Features

- **Infinite Creative Canvas**: A flexible workspace powered by React Flow for organizing AI thoughts and generations.
- **Multi-Model Orchestration**: Seamlessly switch between and chain models for Text/Vision, Image Generation, and Video Generation.
- **Precise Visual Context (PIN System)**: Mark specific areas of an image with "PINs" to use as targeted context for subsequent generations.
- **Smart Node Linking**: Automatically creates parent-child relationships between nodes, allowing for iterative refinement.
- **Inpainting & Masking**: Built-in masking tool to define areas for image-to-image or inpainting tasks.
- **Provider Management**: Deep integration with Google Gemini (Native) and OpenAI-compatible aggregators (like 12AI).
- **Global System Mock**: A one-click toggle to simulate AI responses for rapid prototyping without consuming API credits.
- **Local-First Security**: API keys and configurations are stored locally in your browser's storage.

## 🛠 Technical Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS (Modern utility-first approach)
- **State Management**: Zustand (Persistent store with local storage)
- **Canvas Engine**: @xyflow/react (React Flow)
- **Animations**: Motion (Framer Motion)
- **Icons**: Lucide React
- **Backend**: Express (Node.js) serving as a proxy for API calls
- **AI Integration**: @google/genai (Gemini API) and custom OpenAI-compatible fetchers

## 📂 Project Structure

- `/src/App.tsx`: Main application entry and canvas layout.
- `/src/CreativeNode.tsx`: The core functional node supporting Text, Image, and Video.
- `/src/store.ts`: Centralized state management for nodes, edges, and providers.
- `/src/services/aiService.ts`: Unified interface for calling different AI providers.
- `/src/components/ModelsModal.tsx`: Advanced management UI for AI models and keys.
- `/src/components/PromptInput.tsx`: Specialized input with support for @mentions and PIN references.

## 🚦 Getting Started

1. **Configure Providers**: Open the "Models" settings (Zap icon) to add your Gemini or OpenAI-compatible API keys.
2. **Create Nodes**: Use the "Add Node" buttons to start your workflow.
3. **Chain Context**: Use `@IMG_n` or `@IMG_n_PIN_m` in your prompts to reference outputs from other nodes.
4. **Run**: Click the Play button on any node to trigger the AI generation.

---

*Crafted with precision for the next generation of AI creators.*
