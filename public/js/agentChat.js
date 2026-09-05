/**
 * OmniAgent Commerce — AI Commerce Chat Interface
 * Screen 1: Conversational product discovery with the AI agent.
 */

(function() {
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const chatSend = document.getElementById('chatSend');
  const chatReset = document.getElementById('chatReset');

  let isProcessing = false;

  // Send message
  chatSend.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  chatReset.addEventListener('click', async () => {
    try {
      await api('/api/agent/reset', {
        method: 'POST',
        body: { session_id: AppState.sessionId }
      });
      chatMessages.innerHTML = '';
      addMessage('assistant', 'Conversation reset! How can I help you today? 🛍️');
      showToast('Conversation reset', 'info');
    } catch (e) {
      showToast('Failed to reset', 'error');
    }
  });

  async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message || isProcessing) return;

    if (!AppState.geminiConfigured) {
      showToast('Gemini API Key not configured. Get FREE key at aistudio.google.com/app/apikey', 'error');
      return;
    }

    // Add user message
    addMessage('user', message);
    chatInput.value = '';
    isProcessing = true;
    chatSend.disabled = true;

    // Show typing indicator
    const typingId = addTypingIndicator();

    try {
      const data = await api('/api/agent/chat', {
        method: 'POST',
        body: { message, session_id: AppState.sessionId }
      });

      removeTypingIndicator(typingId);

      // Parse response for product cards
      const response = data.response;
      addMessage('assistant', response, data.toolCalls);

      // If tools were used, show a subtle indicator
      if (data.toolCalls && data.toolCalls.length > 0) {
        const toolNames = data.toolCalls.map(t => t.tool).join(', ');
        addSystemNote(`Tools used: ${toolNames}`);
      }
    } catch (error) {
      removeTypingIndicator(typingId);
      addMessage('assistant', `I'm sorry, I encountered an error: ${error.message}. Please try again.`);
      showToast(error.message, 'error');
    } finally {
      isProcessing = false;
      chatSend.disabled = false;
      chatInput.focus();
    }
  }

  function addMessage(role, content, toolCalls = []) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.textContent = role === 'assistant' ? '🤖' : '👤';

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    // Parse markdown-like formatting
    bubble.innerHTML = formatMessage(content);

    // Add "Add to Cart" buttons for product mentions
    const addToCartButtons = extractProductActions(content);
    if (addToCartButtons.length > 0 && role === 'assistant') {
      const actionsDiv = document.createElement('div');
      actionsDiv.style.cssText = 'margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;';
      addToCartButtons.forEach(action => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary btn-sm';
        btn.textContent = `🛒 Add ${action.name}`;
        btn.onclick = () => addProductToCart(action.id, action.name);
        actionsDiv.appendChild(btn);
      });
      bubble.appendChild(actionsDiv);
    }

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(bubble);
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function addSystemNote(text) {
    const note = document.createElement('div');
    note.style.cssText = 'text-align:center;font-size:0.6875rem;color:var(--text-muted);padding:4px 0;';
    note.textContent = `⚡ ${text}`;
    chatMessages.appendChild(note);
  }

  function addTypingIndicator() {
    const id = 'typing_' + Date.now();
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message assistant';
    msgDiv.id = id;

    const avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.textContent = '🤖';

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.innerHTML = '<span class="loading-dots" style="color:var(--text-tertiary)">Thinking</span>';

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(bubble);
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return id;
  }

  function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function formatMessage(text) {
    if (!text) return '';
    // Bold
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Bullet points
    text = text.replace(/^[-•]\s/gm, '• ');
    // Line breaks
    text = text.replace(/\n/g, '<br>');
    // Currency formatting
    text = text.replace(/₹(\d[\d,]*)/g, '<strong style="color:var(--success)">₹$1</strong>');
    return text;
  }

  function extractProductActions(content) {
    const actions = [];
    // Match product IDs mentioned in the response
    const matches = content.match(/prod_\d{3}/g);
    if (matches) {
      const uniqueIds = [...new Set(matches)];
      uniqueIds.slice(0, 3).forEach(id => {
        // Try to extract product name near the ID
        const nameMatch = content.match(new RegExp(`(\\w[\\w\\s-]+)\\s*\\(?${id}\\)?`, 'i'));
        actions.push({
          id,
          name: nameMatch ? nameMatch[1].trim().slice(0, 20) : id
        });
      });
    }
    return actions;
  }

  async function addProductToCart(productId, productName) {
    try {
      const data = await api('/api/cart/add', {
        method: 'POST',
        body: {
          session_id: AppState.sessionId,
          product_id: productId,
          quantity: 1
        }
      });

      if (data.success) {
        AppState.cart = data.cart;
        updateCartBadge(data.cart.itemCount);
        showToast(`${productName} added to cart!`, 'success');
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  }
})();
