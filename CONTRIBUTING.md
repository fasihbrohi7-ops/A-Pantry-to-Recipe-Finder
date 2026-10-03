# Contributing to PantryCraft 🍳

Thank you for your interest in contributing to **PantryCraft (Pantry-to-Recipe Finder)**! We welcome contributions from developers of all skill levels.

---

## 🛠️ Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/fasihbrohi7-ops/A-Pantry-to-Recipe-Finder.git
   cd A-Pantry-to-Recipe-Finder
   ```

2. **Create a virtual environment (recommended):**
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables (optional for local dev):**
   ```bash
   cp .env.example .env.local
   ```

5. **Start local development server:**
   ```bash
   python api/index.py
   ```
   Open `http://localhost:5000` in your browser.

---

## 🌿 Branching & Workflow

1. Create a feature branch with a descriptive name:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```
2. Keep commits concise and descriptive:
   ```bash
   git commit -m "feat: add dietary filter support for vegetarian recipes"
   ```
3. Run verification tests before submitting your Pull Request:
   ```bash
   python -c "from api.index import app; client = app.test_client(); assert client.get('/api/health').status_code == 200"
   ```
4. Push to your fork and submit a Pull Request against the `main` branch.

---

## 📋 Code Style & Principles

- **Backend**: Clean Python with typing hints where appropriate, comprehensive docstrings, and error handling for external API interactions.
- **Frontend**: Vanilla HTML5/CSS3/JavaScript (ES6+). Avoid unnecessary heavy npm packages or build steps unless discussed.
- **Design**: Maintain modern, accessible, dark-mode luxury culinary aesthetics with responsive layouts across mobile, tablet, and desktop screens.

---

## 📄 License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
