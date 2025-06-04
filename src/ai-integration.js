document.addEventListener('DOMContentLoaded', () => {
    // Initialize variables
    let ollamaUrl = localStorage.getItem('ollamaUrl') || 'http://localhost:11434';
    let modelName = localStorage.getItem('modelName') || 'llama2';
    let currentMessageDiv = null;
    let currentMessageContent = '';
    let editor = null; // Will store the CodeMirror instance
    let lastNewNoteContent = null; // Store the last suggested note content
    let isResizing = false;
    let startX;
    let startWidth;
    let chatHistory = []; // Store chat history
    let lastOriginalContent = ''; // Store original content before modification
    let lastModifiedContent = ''; // Store modified content
    
    // Get DOM elements
    const aiBtn = document.getElementById('ai-btn');
    const aiDropdown = document.getElementById('ai-dropdown');
    const aiSettings = document.getElementById('ai-settings');
    const toggleChat = document.getElementById('toggle-chat');
    const toggleAiModifier = document.getElementById('toggle-ai-modifier');
    const settingsDialog = document.getElementById('ai-settings-dialog');
    const saveSettings = document.getElementById('save-settings');
    const cancelSettings = document.getElementById('cancel-settings');
    const chatSection = document.querySelector('.chat-section');
    const closeChat = document.getElementById('close-chat');
    const chatInput = document.getElementById('chat-input');
    const sendMessage = document.getElementById('send-message');
    const chatMessages = document.getElementById('chat-messages');
    const clearChat = document.getElementById('clear-chat');
    
    // AI Content Modifier elements
    const aiContentModifier = document.getElementById('ai-content-modifier');
    const closeModifier = document.getElementById('close-modifier');
    const modifierPrompt = document.getElementById('modifier-prompt');
    const modifyContent = document.getElementById('modify-content');
    const aiModificationResult = document.getElementById('ai-modification-result');
    const diffDisplay = document.getElementById('diff-display');
    const acceptChanges = document.getElementById('accept-changes');
    const rejectChanges = document.getElementById('reject-changes');
    const loadingOverlay = document.getElementById('loading-overlay');
    
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
    
    // Toggle AI content modifier
    toggleAiModifier.addEventListener('click', () => {
        aiContentModifier.classList.toggle('hidden');
        aiDropdown.classList.remove('show');
        
        // Update placeholder text based on whether note is empty or not
        if (editor) {
            const isEmpty = editor.getValue().trim() === '';
            modifierPrompt.placeholder = isEmpty ? 
                "Describe the note you want to create..." : 
                "Describe how you want to modify this note...";
            
            // Update button text
            modifyContent.textContent = isEmpty ? "Create Content" : "Modify Content";
        }
    });
    
    // Close AI content modifier
    closeModifier.addEventListener('click', () => {
        aiContentModifier.classList.add('hidden');
    });
    
    // Close chat panel
    closeChat.addEventListener('click', () => {
        chatSection.classList.add('hidden');
    });
    
    // Show settings dialog
    aiSettings.addEventListener('click', () => {
        document.getElementById('ollama-url').value = ollamaUrl;
        document.getElementById('model-name').value = modelName;
        settingsDialog.classList.remove('hidden');
        aiDropdown.classList.remove('show');
    });
    
    // Save settings
    saveSettings.addEventListener('click', () => {
        ollamaUrl = document.getElementById('ollama-url').value.trim();
        modelName = document.getElementById('model-name').value.trim();
        
        localStorage.setItem('ollamaUrl', ollamaUrl);
        localStorage.setItem('modelName', modelName);
        
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
    
    // Close AI modification result dialog when clicking outside
    aiModificationResult.addEventListener('click', (e) => {
        if (e.target === aiModificationResult) {
            aiModificationResult.classList.add('hidden');
        }
    });
    
    // Handle chat input
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage.click();
        }
    });
    
    // Handle modifier prompt input
    modifierPrompt.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            modifyContent.click();
        }
    });
    
    // Accept AI changes
    acceptChanges.addEventListener('click', () => {
        if (editor && lastModifiedContent) {
            editor.setValue(lastModifiedContent);
            aiModificationResult.classList.add('hidden');
        }
    });
    
    // Reject AI changes
    rejectChanges.addEventListener('click', () => {
        aiModificationResult.classList.add('hidden');
    });
    
    // Modify content with AI
    modifyContent.addEventListener('click', async () => {
        const prompt = modifierPrompt.value.trim();
        if (!prompt) {
            alert('Please enter a prompt for how you want to modify or create content.');
            return;
        }
        
        if (!editor) {
            alert('Editor not initialized yet. Please try again in a moment.');
            return;
        }
        
        const noteContent = editor.getValue();
        const isEmpty = noteContent.trim() === '';
        lastOriginalContent = noteContent;
        
        // Show loading overlay
        loadingOverlay.classList.remove('hidden');
        
        try {
            // Construct different prompts based on whether the note is empty or not
            let systemPrompt;
            
            if (isEmpty) {
                // For empty notes, ask AI to create new content
                systemPrompt = `You are an AI assistant that helps users create new notes. The user wants you to create note content based on this instruction: "${prompt}"

Please provide complete note content based on the user's request. Return ONLY the content without any additional explanations or formatting. Create comprehensive, well-structured content that matches what the user is asking for.`;
                
                // Update dialog title and button text
                document.getElementById('modification-result-title').textContent = 'AI Content Creation';
                document.getElementById('accept-changes').textContent = 'Use This Content';
            } else {
                // For existing notes, ask AI to modify content
                systemPrompt = `You are an AI assistant that helps users modify their notes. The user has the following note content:

<original_content>
${noteContent}
</original_content>

The user wants you to modify this content according to this instruction: "${prompt}"

Please provide the modified version of the note content. Return ONLY the modified content without any additional explanations or formatting. The result should be a complete replacement of the original content.`;
                
                // Update dialog title and button text
                document.getElementById('modification-result-title').textContent = 'AI Content Modification';
                document.getElementById('accept-changes').textContent = 'Accept Changes';
            }
            
            // Call Ollama API
            const response = await fetch(`${ollamaUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: modelName,
                    prompt: systemPrompt,
                    stream: false
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to get response from Ollama API');
            }
            
            const data = await response.json();
            lastModifiedContent = data.response.trim();
            
            // Generate diff display
            generateDiffDisplay(lastOriginalContent, lastModifiedContent);
            
            // Show the modification result dialog
            aiModificationResult.classList.remove('hidden');
        } catch (error) {
            console.error('Error modifying content:', error);
            alert('Error modifying content: ' + error.message);
        } finally {
            // Hide loading overlay
            loadingOverlay.classList.add('hidden');
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
        
        // Construct the system prompt
        const systemPrompt = `You are an AI assistant that helps users with their notes. You can provide general assistance, answer questions, and help with writing and editing when asked.
Chat history:
${formattedHistory}
The current content of user note:
<note_content>
${noteContent}
</note_content>

Only if the user explicitly asks you to rewrite or modify the note content, provide the new version within these tags:
<new_note>
note_content
</new_note>

Otherwise, just provide a normal helpful response.

The current user prompt is: ${message}`
        
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
                    prompt: systemPrompt,
                    stream: true
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
            console.error('Error sending message:', error);
            addMessageToChat('ai', 'Error: ' + error.message);
        }
    });
    
    // Clear chat
    clearChat.addEventListener('click', () => {
        chatMessages.innerHTML = '';
        chatHistory = [];
    });
    
    // Function to generate diff display
    function generateDiffDisplay(originalText, modifiedText) {
        diffDisplay.innerHTML = '';
        
        // Special handling for empty original content
        if (originalText.trim() === '') {
            // For empty notes, just show the new content without diff markers
            const headerMessage = document.createElement('div');
            headerMessage.className = 'diff-header-message';
            headerMessage.textContent = 'Creating new content based on your request:';
            diffDisplay.appendChild(headerMessage);
            
            const modifiedLines = modifiedText.split('\n');
            
            modifiedLines.forEach(line => {
                const contentLine = document.createElement('div');
                contentLine.className = 'diff-line diff-line-new-content';
                contentLine.textContent = line;
                diffDisplay.appendChild(contentLine);
            });
            
            return;
        }
        
        // Regular diff for modifications to existing content
        const originalLines = originalText.split('\n');
        const modifiedLines = modifiedText.split('\n');
        
        // Simple line-by-line diff for demonstration
        // In a real app, you might want to use a more sophisticated diff algorithm
        const maxLines = Math.max(originalLines.length, modifiedLines.length);
        
        for (let i = 0; i < maxLines; i++) {
            const originalLine = i < originalLines.length ? originalLines[i] : '';
            const modifiedLine = i < modifiedLines.length ? modifiedLines[i] : '';
            
            if (originalLine !== modifiedLine) {
                if (originalLine) {
                    const removedLine = document.createElement('div');
                    removedLine.className = 'diff-line diff-line-removed';
                    removedLine.textContent = '- ' + originalLine;
                    diffDisplay.appendChild(removedLine);
                }
                
                if (modifiedLine) {
                    const addedLine = document.createElement('div');
                    addedLine.className = 'diff-line diff-line-added';
                    addedLine.textContent = '+ ' + modifiedLine;
                    diffDisplay.appendChild(addedLine);
                }
            } else {
                const unchangedLine = document.createElement('div');
                unchangedLine.className = 'diff-line';
                unchangedLine.textContent = '  ' + originalLine;
                diffDisplay.appendChild(unchangedLine);
            }
        }
    }
    
    // Function to add a message to the chat
    function addMessageToChat(type, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}-message`;
        
        // For AI messages, we'll render Markdown
        if (type === 'ai') {
            // Check if content contains a note suggestion
            const newNoteMatch = content.match(/<new_note>\n([\s\S]*?)\n<\/new_note>/);
            if (newNoteMatch) {
                // Replace the <new_note> tags with styled div
                const beforeNote = content.substring(0, content.indexOf('<new_note>'));
                const afterNote = content.substring(content.indexOf('</new_note>') + '</new_note>'.length);
                
                const noteContent = newNoteMatch[1].trim();
                
                const renderedContent = `
                    ${beforeNote ? DOMPurify.sanitize(marked.parse(beforeNote)) : ''}
                    <div class="suggested-note">
                        <div class="suggested-note-header">📝 Suggested Note Content:</div>
                        <pre class="suggested-note-content">${noteContent}</pre>
                    </div>
                    ${afterNote ? DOMPurify.sanitize(marked.parse(afterNote)) : ''}
                `;
                
                messageDiv.innerHTML = renderedContent;
            } else {
                // Regular markdown rendering
                messageDiv.innerHTML = DOMPurify.sanitize(marked.parse(content));
            }
            
            // Add message actions (copy, etc.)
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';
            
            const copyBtn = document.createElement('button');
            copyBtn.className = 'message-action-btn copy';
            copyBtn.innerHTML = '📋';
            copyBtn.title = 'Copy to clipboard';
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(content).then(() => {
                    showCopyNotification(copyBtn);
                });
            });
            
            actionsDiv.appendChild(copyBtn);
            messageDiv.appendChild(actionsDiv);
            
        } else {
            // User messages are plain text
            messageDiv.textContent = content;
        }
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Function to update the current AI message content
    function updateMessageContent(content) {
        if (!currentMessageDiv) return;
        
        // Check if content contains a note suggestion
        const newNoteMatch = content.match(/<new_note>\n([\s\S]*?)\n<\/new_note>/);
        if (newNoteMatch) {
            // Replace the <new_note> tags with styled div
            const beforeNote = content.substring(0, content.indexOf('<new_note>'));
            const afterNote = content.substring(content.indexOf('</new_note>') + '</new_note>'.length);
            
            const noteContent = newNoteMatch[1].trim();
            
            const renderedContent = `
                ${beforeNote ? DOMPurify.sanitize(marked.parse(beforeNote)) : ''}
                <div class="suggested-note">
                    <div class="suggested-note-header">📝 Suggested Note Content:</div>
                    <pre class="suggested-note-content">${noteContent}</pre>
                </div>
                ${afterNote ? DOMPurify.sanitize(marked.parse(afterNote)) : ''}
            `;
            
            currentMessageDiv.innerHTML = renderedContent;
        } else {
            // Regular markdown rendering
            currentMessageDiv.innerHTML = DOMPurify.sanitize(marked.parse(content));
        }
        
        // Add message actions (copy, etc.)
        let actionsDiv = currentMessageDiv.querySelector('.message-actions');
        if (!actionsDiv) {
            actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';
            
            const copyBtn = document.createElement('button');
            copyBtn.className = 'message-action-btn copy';
            copyBtn.innerHTML = '📋';
            copyBtn.title = 'Copy to clipboard';
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(content).then(() => {
                    showCopyNotification(copyBtn);
                });
            });
            
            actionsDiv.appendChild(copyBtn);
            currentMessageDiv.appendChild(actionsDiv);
        }
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Function to add apply button for note suggestions
    function addApplyButton() {
        if (!currentMessageDiv || !lastNewNoteContent) return;
        
        // Check if apply button already exists
        if (currentMessageDiv.querySelector('.apply-changes-container')) return;
        
        const applyContainer = document.createElement('div');
        applyContainer.className = 'apply-changes-container';
        
        const applyButton = document.createElement('button');
        applyButton.className = 'apply-changes-btn';
        applyButton.textContent = 'Apply to Editor';
        applyButton.addEventListener('click', () => {
            if (editor && lastNewNoteContent) {
                editor.setValue(lastNewNoteContent);
                
                // Show notification
                const notification = document.createElement('div');
                notification.className = 'apply-notification';
                notification.textContent = 'Changes applied to editor!';
                applyContainer.appendChild(notification);
                
                // Remove notification after 3 seconds
                setTimeout(() => {
                    notification.remove();
                }, 3000);
            }
        });
        
        applyContainer.appendChild(applyButton);
        currentMessageDiv.appendChild(applyContainer);
    }
    
    // Function to show copy notification
    function showCopyNotification(button) {
        // Check if notification already exists
        let notification = button.parentElement.querySelector('.copy-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.className = 'copy-notification';
            notification.textContent = 'Copied!';
            button.parentElement.appendChild(notification);
        }
        
        // Show notification
        notification.classList.add('show');
        
        // Hide notification after 2 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 2000);
    }
    
    // Handle window resize to adjust chat panel
    window.addEventListener('resize', () => {
        // Adjust chat panel height if needed
    });
    
    // Make chat panel resizable
    const chatResizer = document.createElement('div');
    chatResizer.className = 'chat-resizer';
    chatSection.appendChild(chatResizer);
    
    chatResizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = parseInt(getComputedStyle(chatSection).width, 10);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        e.preventDefault();
    });
    
    function handleMouseMove(e) {
        if (!isResizing) return;
        const width = startWidth - (e.clientX - startX);
        chatSection.style.width = `${Math.max(200, Math.min(800, width))}px`;
    }
    
    function handleMouseUp() {
        isResizing = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }
    
    // Listen for IPC events from main process
    window.api.onAiModifyContent && window.api.onAiModifyContent((event, content, prompt) => {
        lastOriginalContent = content;
        const isEmpty = content.trim() === '';
        
        // Construct different prompts based on whether the note is empty or not
        let systemPrompt;
        
        if (isEmpty) {
            // For empty notes, ask AI to create new content
            systemPrompt = `You are an AI assistant that helps users create new notes. The user wants you to create note content based on this instruction: "${prompt}"

Please provide complete note content based on the user's request. Return ONLY the content without any additional explanations or formatting. Create comprehensive, well-structured content that matches what the user is asking for.`;
            
            // Update dialog title and button text
            document.getElementById('modification-result-title').textContent = 'AI Content Creation';
            document.getElementById('accept-changes').textContent = 'Use This Content';
        } else {
            // For existing notes, ask AI to modify content
            systemPrompt = `You are an AI assistant that helps users modify their notes. The user has the following note content:

<original_content>
${content}
</original_content>

The user wants you to modify this content according to this instruction: "${prompt}"

Please provide the modified version of the note content. Return ONLY the modified content without any additional explanations or formatting. The result should be a complete replacement of the original content.`;
            
            // Update dialog title and button text
            document.getElementById('modification-result-title').textContent = 'AI Content Modification';
            document.getElementById('accept-changes').textContent = 'Accept Changes';
        }
        
        // Call Ollama API
        fetch(`${ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: modelName,
                prompt: systemPrompt,
                stream: false
            })
        })
        .then(response => response.json())
        .then(data => {
            lastModifiedContent = data.response.trim();
            // Generate diff display
            generateDiffDisplay(lastOriginalContent, lastModifiedContent);
            // Show the modification result dialog
            aiModificationResult.classList.remove('hidden');
        })
        .catch(error => {
            console.error('Error modifying content:', error);
            alert('Error modifying content: ' + error.message);
        });
    });
}); 