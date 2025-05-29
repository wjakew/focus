document.addEventListener('DOMContentLoaded', () => {
    // Initialize variables
    let ollamaUrl = localStorage.getItem('ollamaUrl') || 'http://localhost:11434';
    let modelName = localStorage.getItem('modelName') || 'llama2';
    let systemPrompt = localStorage.getItem('systemPrompt') || `You are an AI assistant that helps users create and manage notes.

IMPORTANT: Always wrap note content in <new_note> tags when:
- User asks to create a new note
- User asks to modify/edit the current note
- User asks to rewrite the note content
- User asks you to return code from the note
- User requests any changes to the note structure or content

Format your response with the updated note content like this:
<new_note>
[complete note content here]
</new_note>

For general questions about the note or requests that don't involve modifying the note content, respond normally without the <new_note> tags.`;
    let currentMessageDiv = null;
    let currentMessageContent = '';
    let editor = null; // Will store the CodeMirror instance
    let lastNewNoteContent = null; // Store the last suggested note content
    let isResizing = false;
    let startX;
    let startWidth;
    let chatHistory = []; // Store chat history
    
    // Get DOM elements
    const aiBtn = document.getElementById('ai-btn');
    const aiDropdown = document.getElementById('ai-dropdown');
    const aiSettings = document.getElementById('ai-settings');
    const toggleChat = document.getElementById('toggle-chat');
    const settingsDialog = document.getElementById('ai-settings-dialog');
    const saveSettings = document.getElementById('save-settings');
    const cancelSettings = document.getElementById('cancel-settings');
    const chatSection = document.querySelector('.chat-section');
    const closeChat = document.getElementById('close-chat');
    const chatInput = document.getElementById('chat-input');
    const sendMessage = document.getElementById('send-message');
    const chatMessages = document.getElementById('chat-messages');
    
    // Add export and clear buttons
    const exportChat = document.createElement('button');
    exportChat.id = 'export-chat';
    exportChat.innerHTML = 'Export';
    exportChat.className = 'chat-control-btn';
    
    const clearChat = document.createElement('button');
    clearChat.id = 'clear-chat';
    clearChat.innerHTML = 'Clear';
    clearChat.className = 'chat-control-btn-delete';
    
    // Insert the new buttons before the close button
    closeChat.parentNode.insertBefore(exportChat, closeChat);
    closeChat.parentNode.insertBefore(clearChat, closeChat);
    
    // Export chat functionality
    exportChat.addEventListener('click', () => {
        let markdown = '# Chat Export\n\n';
        chatHistory.forEach(msg => {
            markdown += `### ${msg.role.charAt(0).toUpperCase() + msg.role.slice(1)}\n${msg.content}\n\n`;
        });
        
        // Create blob and download
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-export-${new Date().toISOString().split('T')[0]}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
    
    // Clear chat functionality
    clearChat.addEventListener('click', () => {
        chatMessages.innerHTML = '';
        chatHistory = [];
        lastNewNoteContent = null;
    });
    
    // Configure marked.js
    marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: false
    });

    // Get the CodeMirror instance from the main editor
    // We need to wait a bit to ensure the editor is initialized
    setTimeout(() => {
        const editorElement = document.querySelector('.CodeMirror').CodeMirror;
        if (editorElement) {
            editor = editorElement;
        }
    }, 1000);
    
    // Toggle AI dropdown
    aiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        aiDropdown.classList.toggle('show');
        // Hide other dropdowns
        document.getElementById('menu-dropdown').classList.remove('show');
        document.getElementById('view-dropdown').classList.remove('show');
    });
    
    // Toggle chat panel
    toggleChat.addEventListener('click', () => {
        chatSection.classList.toggle('hidden');
        aiDropdown.classList.remove('show');
    });
    
    // Close chat panel
    closeChat.addEventListener('click', () => {
        chatSection.classList.add('hidden');
    });
    
    // Show settings dialog
    aiSettings.addEventListener('click', () => {
        document.getElementById('ollama-url').value = ollamaUrl;
        document.getElementById('model-name').value = modelName;
        document.getElementById('system-prompt').value = systemPrompt;
        settingsDialog.classList.remove('hidden');
        aiDropdown.classList.remove('show');
    });
    
    // Save settings
    saveSettings.addEventListener('click', () => {
        ollamaUrl = document.getElementById('ollama-url').value.trim();
        modelName = document.getElementById('model-name').value.trim();
        systemPrompt = document.getElementById('system-prompt').value.trim();
        
        localStorage.setItem('ollamaUrl', ollamaUrl);
        localStorage.setItem('modelName', modelName);
        localStorage.setItem('systemPrompt', systemPrompt);
        
        settingsDialog.classList.add('hidden');
    });
    
    // Cancel settings
    cancelSettings.addEventListener('click', () => {
        settingsDialog.classList.add('hidden');
    });
    
    // Close settings dialog when clicking outside
    settingsDialog.addEventListener('click', (e) => {
        if (e.target === settingsDialog) {
            settingsDialog.classList.add('hidden');
        }
    });
    
    // Handle chat input
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage.click();
        }
    });
    
    // Send message
    sendMessage.addEventListener('click', async () => {
        const message = chatInput.value.trim();
        if (!message) return;
        
        // Get current editor content
        const noteContent = editor ? editor.getValue() : '';
        
        // Add message to chat history
        chatHistory.push({ role: 'user', content: message });
        
        // Format chat history for the system prompt
        const formattedHistory = chatHistory.map(msg => 
            `${msg.role}: ${msg.content}`
        ).join('\n');
        
        // Construct the prompt
        const prompt = `${systemPrompt}

Chat history:
${formattedHistory}

Current note content:
<note_content>
${noteContent}
</note_content>

Current user request: ${message}`;
        
        // Add user message to chat
        addMessageToChat('user', message);
        chatInput.value = '';
        
        try {
            // Create a new message container for AI response
            currentMessageContent = '';
            currentMessageDiv = document.createElement('div');
            currentMessageDiv.className = 'chat-message ai-message';
            chatMessages.appendChild(currentMessageDiv);
            lastNewNoteContent = null; // Reset last note content
            
            // Send request to Ollama API with streaming
            const response = await fetch(`${ollamaUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: modelName,
                    prompt: prompt,
                    stream: true,
                    system: "You are an AI assistant specialized in helping users write and edit notes. Always maintain a professional and helpful tone."
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to get response from Ollama API');
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.trim() === '') continue;
                    
                    try {
                        const data = JSON.parse(line);
                        if (data.response) {
                            currentMessageContent += data.response;
                            updateMessageContent(currentMessageContent);
                        }
                    } catch (e) {
                        console.error('Error parsing JSON:', e);
                    }
                }
            }
            
            // After streaming is complete, add AI response to chat history
            chatHistory.push({ role: 'assistant', content: currentMessageContent });
            
            // Check for new note content
            const newNoteMatch = currentMessageContent.match(/<new_note>\n([\s\S]*?)\n<\/new_note>/);
            if (newNoteMatch) {
                lastNewNoteContent = newNoteMatch[1].trim();
                addApplyButton();
            }
            
        } catch (error) {
            console.error('Error:', error);
            addMessageToChat('ai', 'Sorry, there was an error processing your request. Please check your Ollama settings and make sure the service is running.');
        }
    });
    
    // Function to add message to chat
    function addMessageToChat(type, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}-message`;
        
        if (type === 'user') {
            // For user messages, escape HTML and maintain line breaks
            messageDiv.textContent = content;
        } else {
            // For AI messages, render as markdown
            messageDiv.innerHTML = DOMPurify.sanitize(marked.parse(content));
        }
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Function to update streaming message content
    function updateMessageContent(content) {
        if (currentMessageDiv) {
            currentMessageDiv.innerHTML = DOMPurify.sanitize(marked.parse(content));
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    // Function to add apply button to the current message
    function addApplyButton() {
        if (!currentMessageDiv || !lastNewNoteContent) return;

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'apply-changes-container';
        
        const applyButton = document.createElement('button');
        applyButton.className = 'apply-changes-btn';
        applyButton.textContent = 'Apply Changes to Note';
        applyButton.onclick = () => {
            if (editor && lastNewNoteContent) {
                editor.setValue(lastNewNoteContent);
                // Add a small notification
                const notification = document.createElement('span');
                notification.className = 'apply-notification';
                notification.textContent = '✓ Changes applied';
                buttonContainer.appendChild(notification);
                applyButton.disabled = true;
                // Remove notification after 2 seconds
                setTimeout(() => {
                    notification.remove();
                }, 2000);
            }
        };
        
        buttonContainer.appendChild(applyButton);
        currentMessageDiv.appendChild(buttonContainer);
    }

    // Add resize event listeners
    chatSection.addEventListener('mousedown', (e) => {
        // Check if clicking on the resize handle (within 10px of the left border)
        if (e.offsetX <= 10) {
            isResizing = true;
            startX = e.pageX;
            startWidth = chatSection.offsetWidth;
            
            // Add event listeners for drag operation
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            
            // Prevent text selection during resize
            document.body.style.userSelect = 'none';
        }
    });

    function handleMouseMove(e) {
        if (!isResizing) return;
        
        const width = startWidth - (e.pageX - startX);
        // Set minimum and maximum width constraints
        if (width >= 200 && width <= 800) {
            chatSection.style.width = width + 'px';
            // If CodeMirror editor exists, trigger a refresh to adjust layout
            if (editor) {
                editor.refresh();
            }
        }
    }

    function handleMouseUp() {
        isResizing = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
    }
}); 