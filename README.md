# Blueprint Buddy

AI-powered furniture design application that transforms natural language descriptions into complete, buildable furniture plans with 3D visualization.

## 🚀 Features

- **Natural Language Design**: Describe furniture in plain English
- **Multi-Agent AI System**: Specialized agents for dimensions, materials, joinery, and validation
- **Engineering Validation**: Real structural analysis and physics validation
- **Knowledge Graph**: Built-in furniture engineering expertise
- **Cost Estimation**: Material costs calculated automatically
- **3D Preview**: Visualize designs before building (placeholder in MVP)

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/blueprint-buddy.git
cd blueprint-buddy

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your OpenAI API key to .env
```

## 🛠️ Development

```bash
# Start development server
npm run dev

# Run type checking
npm run typecheck

# Run linting
npm run lint

# Build for production
npm run build
```

## 🏗️ Architecture

Blueprint Buddy uses a sophisticated multi-agent architecture:

- **Intent Classifier**: Routes user input to appropriate specialized agents
- **Dimension Agent**: Handles measurements and ergonomic validation
- **Material Agent**: Selects appropriate wood types and materials
- **Joinery Agent**: Recommends structural connections
- **Validation Agent**: Ensures designs are buildable and safe
- **Cohesion Coordinator**: Ensures all agents work together cohesively

## 🌟 Key Technologies

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **AI**: OpenAI API with structured outputs
- **3D**: Three.js (placeholder implementation)
- **State Management**: Custom shared state manager with React integration
- **Knowledge Base**: Built-in engineering data (span tables, material properties)

## 📝 Usage Example

1. Start the app and navigate to the Designer page
2. Type: "I want to build a bookshelf for my living room"
3. Specify dimensions: "6 feet tall and 3 feet wide"
4. Choose materials: "Use pine wood"
5. The system will validate the design and suggest improvements
6. View the 3D preview and build details

## 🔧 Configuration

The app can be configured through environment variables:

```env
VITE_OPENAI_API_KEY=your_api_key_here
VITE_SUPABASE_URL=your_supabase_url (optional)
VITE_SUPABASE_ANON_KEY=your_supabase_key (optional)
```

## 🚦 Current Status

**MVP Stage** - Core functionality implemented:
- ✅ Intent classification system
- ✅ Agent coordination
- ✅ Basic UI
- ✅ Knowledge graph with engineering data
- ⏳ 3D model generation (placeholder)
- ⏳ PDF export
- ⏳ User authentication

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📄 License

MIT License - see LICENSE file for details
