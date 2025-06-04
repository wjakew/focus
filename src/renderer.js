// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize variables
    let editor;
    let currentContent = '';
    let currentFilePath = null;
    let isToolbarVisible = true;
    let isToolbarFloating = true;  // Set floating mode as default
    
    // Load theme preference from localStorage or set default to light
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Menu functionality
    const menuBtn = document.getElementById('menu-btn');
    const menuDropdown = document.getElementById('menu-dropdown');
    const viewBtn = document.getElementById('view-btn');
    const viewDropdown = document.getElementById('view-dropdown');
    const previewSection = document.querySelector('.preview-section');
    const toolbar = document.querySelector('.toolbar');
    
    // Set initial toolbar state to floating
    toolbar.classList.add('floating');
    
    // Update the toolbar mode button text to reflect default state
    document.getElementById('toggle-toolbar-mode').textContent = 'Toolbar Mode: Floating';
    
    // Hide preview by default
    previewSection.classList.add('hidden');
    // Make editor take full width when preview is hidden
    const editorSection = document.querySelector('.editor-section');
    editorSection.style.width = '100%';
    
    // Listen for AI content updates to manually refresh the preview
    document.addEventListener('ai-content-update', (event) => {
        if (event.detail && event.detail.content) {
            updatePreview(event.detail.content);
            updateWordCount(event.detail.content);
            
            // Make sure preview is visible when AI generates content
            if (previewSection.classList.contains('hidden')) {
                togglePreview();
            }
        }
    });
    
    // Save unsaved content when window is about to close
    window.addEventListener('beforeunload', () => {
        // Save current content to localStorage if there's unsaved work
        if (currentContent) {
            localStorage.setItem('lastUnsavedContent', currentContent);
        } else {
            localStorage.removeItem('lastUnsavedContent');
        }
    });
    
    // Toggle menu dropdown
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menuDropdown.classList.toggle('show');
        viewDropdown.classList.remove('show');
    });
    
    // Toggle view dropdown
    viewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        viewDropdown.classList.toggle('show');
        menuDropdown.classList.remove('show');
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        menuDropdown.classList.remove('show');
        viewDropdown.classList.remove('show');
    });
    
    // Function to toggle preview
    function togglePreview() {
        previewSection.classList.toggle('hidden');
        // If preview is hidden, make editor take full width
        editorSection.style.width = previewSection.classList.contains('hidden') ? '100%' : '';
        // Trigger a refresh on the editor to ensure proper rendering
        editor.refresh();
    }
    
    // Toggle preview button click handler
    document.getElementById('toggle-preview').addEventListener('click', togglePreview);
    
    // Toggle toolbar visibility
    document.getElementById('toggle-toolbar').addEventListener('click', () => {
        isToolbarVisible = !isToolbarVisible;
        toolbar.classList.toggle('hidden');
        viewDropdown.classList.remove('show');
    });

    // Toggle toolbar mode (panel/floating)
    document.getElementById('toggle-toolbar-mode').addEventListener('click', (e) => {
        isToolbarFloating = !isToolbarFloating;
        toolbar.classList.toggle('floating');
        e.target.textContent = `Toolbar Mode: ${isToolbarFloating ? 'Floating' : 'Panel'}`;
        viewDropdown.classList.remove('show');
    });
    
    // File operation handlers
    document.getElementById('new-file').addEventListener('click', () => {
        window.api.newFile();
    });
    
    document.getElementById('open-file').addEventListener('click', () => {
        window.api.openFile();
    });
    
    document.getElementById('save-file').addEventListener('click', () => {
        window.api.saveFile();
    });
    
    document.getElementById('save-as').addEventListener('click', () => {
        window.api.saveFileAs();
    });
    
    // Function to show markdown component menu
    function showMarkdownComponentMenu(editor) {
      // Create menu element
      const menu = document.createElement('div');
      menu.className = 'markdown-component-menu';
      menu.style.position = 'absolute';
      menu.style.zIndex = '1000';
      menu.style.backgroundColor = 'var(--toolbar-bg)';
      menu.style.border = '1px solid var(--border-color)';
      menu.style.borderRadius = '4px';
      menu.style.boxShadow = '0 4px 12px var(--shadow-color)';
      menu.style.padding = '8px 0';
      menu.style.minWidth = '200px';

      // Define available components
      const components = [
        { label: 'Heading 1', insert: '# ' },
        { label: 'Heading 2', insert: '## ' },
        { label: 'Heading 3', insert: '### ' },
        { label: 'Bold', insert: '**Bold text**' },
        { label: 'Italic', insert: '*Italic text*' },
        { label: 'Code Block', insert: '```\ncode\n```' },
        { label: 'Inline Code', insert: '`code`' },
        { label: 'Link', insert: '[Link text](url)' },
        { label: 'Image', insert: '![Alt text](image-url)' },
        { label: 'Blockquote', insert: '> ' },
        { label: 'Unordered List', insert: '- ' },
        { label: 'Ordered List', insert: '1. ' },
        { label: 'Task List', insert: '- [ ] ' },
        { label: 'Table', insert: '| Header 1 | Header 2 |\n| -------- | -------- |\n| Cell 1   | Cell 2   |' },
        { label: 'Horizontal Rule', insert: '---\n' }
      ];

      // Add menu items
      components.forEach(component => {
        const item = document.createElement('div');
        item.className = 'markdown-component-item';
        item.style.padding = '8px 16px';
        item.style.cursor = 'pointer';
        item.style.color = 'var(--text-color)';
        item.textContent = component.label;

        item.addEventListener('mouseover', () => {
          item.style.backgroundColor = 'var(--hover-color)';
        });

        item.addEventListener('mouseout', () => {
          item.style.backgroundColor = 'transparent';
        });

        item.addEventListener('click', () => {
          const cursor = editor.getCursor();
          const line = editor.getLine(cursor.line);
          
          // Remove the "/" character
          editor.replaceRange('', { line: cursor.line, ch: cursor.ch - 1 }, cursor);
          
          // Insert the component
          editor.replaceRange(component.insert, cursor);
          
          // Remove the menu
          menu.remove();
          
          // Focus back on editor
          editor.focus();
        });

        menu.appendChild(item);
      });

      // Position the menu at cursor
      const cursor = editor.getCursor();
      const cursorPos = editor.cursorCoords(cursor);
      menu.style.left = cursorPos.left + 'px';
      menu.style.top = cursorPos.top + 20 + 'px';

      // Add menu to editor
      document.body.appendChild(menu);

      // Close menu when clicking outside
      function handleClickOutside(e) {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', handleClickOutside);
        }
      }
      
      // Small delay to prevent immediate closing
      setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 100);
    }
    
    // Initialize CodeMirror editor
    editor = CodeMirror(document.getElementById('editor'), {
      mode: 'markdown',
      lineNumbers: true,
      lineWrapping: true,
      theme: 'default',
      autofocus: true,
      tabSize: 2,
      indentWithTabs: false,
      extraKeys: {
        'Tab': function(cm) {
          if (cm.somethingSelected()) {
            cm.indentSelection('add');
          } else {
            cm.replaceSelection('  ', 'end', '+input');
          }
        },
        'Ctrl-P': togglePreview,  // Add keyboard shortcut for preview toggle
        'Cmd-P': togglePreview    // For Mac users
      }
    });
    
    // Search functionality
    let currentSearchQuery = '';
    let searchMatches = [];
    let currentMatchIndex = -1;
    const searchPanel = document.getElementById('search-panel');
    const searchInput = document.getElementById('search-input');
    const searchResultsCount = document.getElementById('search-results-count');
    const searchPrevBtn = document.getElementById('search-prev');
    const searchNextBtn = document.getElementById('search-next');
    const closeSearchBtn = document.getElementById('close-search');
    
    // Toggle search panel
    function toggleSearchPanel() {
        searchPanel.classList.toggle('hidden');
        if (!searchPanel.classList.contains('hidden')) {
            searchInput.focus();
            
            // If there's selected text, use it as the search term
            const selection = editor.getSelection();
            if (selection) {
                searchInput.value = selection;
                performSearch();
            }
        } else {
            // Clear search when closing
            clearSearch();
        }
    }
    
    // Perform search in the editor
    function performSearch() {
        const query = searchInput.value;
        if (!query || query === '') {
            clearSearch();
            return;
        }
        
        currentSearchQuery = query;
        
        // Clear previous search
        if (editor.state.search) {
            editor.state.search = null;
        }
        
        // Store the cursor position before search
        const cursor = editor.getCursor();
        
        // Collect all matches
        searchMatches = [];
        const content = editor.getValue();
        let searchRegex;
        try {
            searchRegex = new RegExp(query, 'gi');
        } catch (e) {
            // If regex is invalid, search for the literal string
            searchRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        }
        
        let match;
        while ((match = searchRegex.exec(content)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            
            // Convert index to line and character position
            const startPos = indexToPos(content, start);
            const endPos = indexToPos(content, end);
            
            searchMatches.push({
                from: startPos,
                to: endPos
            });
        }
        
        // Update match count
        updateMatchCount();
        
        // Start highlighting from the cursor position
        if (searchMatches.length > 0) {
            // Find the next match from cursor
            currentMatchIndex = findNextMatchFromCursor(cursor);
            highlightMatches();
            jumpToMatch(currentMatchIndex);
        }
    }
    
    // Helper function to convert string index to line and character position
    function indexToPos(text, index) {
        const lines = text.substr(0, index).split('\n');
        const lineNum = lines.length - 1;
        const charPos = lines[lineNum].length;
        return { line: lineNum, ch: charPos };
    }
    
    // Find the next match from the cursor position
    function findNextMatchFromCursor(cursor) {
        for (let i = 0; i < searchMatches.length; i++) {
            const match = searchMatches[i];
            
            // If match is after cursor
            if (match.from.line > cursor.line || 
               (match.from.line === cursor.line && match.from.ch >= cursor.ch)) {
                return i;
            }
        }
        // If no match after cursor, start from beginning
        return 0;
    }
    
    // Highlight all matches
    function highlightMatches() {
        // Clear previous marks
        editor.getAllMarks().forEach(mark => mark.clear());
        
        // Mark all matches
        searchMatches.forEach((match, index) => {
            const matchMark = editor.markText(
                match.from,
                match.to,
                {
                    className: index === currentMatchIndex ? 'cm-searching cm-current' : 'cm-searching'
                }
            );
        });
    }
    
    // Jump to a specific match
    function jumpToMatch(index) {
        if (index >= 0 && index < searchMatches.length) {
            currentMatchIndex = index;
            const match = searchMatches[index];
            
            // Scroll to the match
            editor.scrollIntoView({
                from: match.from,
                to: match.to
            }, 50);
            
            // Select the text
            editor.setSelection(match.from, match.to);
            
            // Update highlights
            highlightMatches();
            
            // Update match count display
            updateMatchCount();
        }
    }
    
    // Go to next match
    function nextMatch() {
        if (searchMatches.length === 0) return;
        
        currentMatchIndex = (currentMatchIndex + 1) % searchMatches.length;
        jumpToMatch(currentMatchIndex);
    }
    
    // Go to previous match
    function prevMatch() {
        if (searchMatches.length === 0) return;
        
        currentMatchIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
        jumpToMatch(currentMatchIndex);
    }
    
    // Update the match count display
    function updateMatchCount() {
        if (searchMatches.length > 0) {
            searchResultsCount.textContent = `${currentMatchIndex + 1}/${searchMatches.length}`;
            searchPrevBtn.disabled = false;
            searchNextBtn.disabled = false;
        } else {
            searchResultsCount.textContent = '0/0';
            searchPrevBtn.disabled = true;
            searchNextBtn.disabled = true;
        }
    }
    
    // Clear search highlighting
    function clearSearch() {
        editor.getAllMarks().forEach(mark => mark.clear());
        searchMatches = [];
        currentMatchIndex = -1;
        currentSearchQuery = '';
        searchInput.value = '';
        updateMatchCount();
    }
    
    // Event listeners for search
    document.getElementById('toggle-search').addEventListener('click', toggleSearchPanel);
    searchInput.addEventListener('input', performSearch);
    searchNextBtn.addEventListener('click', nextMatch);
    searchPrevBtn.addEventListener('click', prevMatch);
    closeSearchBtn.addEventListener('click', toggleSearchPanel);
    
    // Add keyboard shortcuts for search
    editor.setOption('extraKeys', Object.assign(editor.getOption('extraKeys') || {}, {
        'Ctrl-F': toggleSearchPanel,
        'Cmd-F': toggleSearchPanel,
        'F3': nextMatch,
        'Shift-F3': prevMatch,
        'Escape': () => {
            if (!searchPanel.classList.contains('hidden')) {
                toggleSearchPanel();
                return true;
            }
            return false;
        }
    }));
    
    // Restore unsaved content if available and no file is opened
    const lastUnsavedContent = localStorage.getItem('lastUnsavedContent');
    if (lastUnsavedContent && !currentFilePath) {
        editor.setValue(lastUnsavedContent);
        currentContent = lastUnsavedContent;
        updatePreview(currentContent);
        updateWordCount(currentContent);
    }
    
    // Add key handler for "/"
    editor.on('keyup', (cm, event) => {
      if (event.key === '/') {
        showMarkdownComponentMenu(cm);
      }
    });
    
    // Update preview when editor changes
    editor.on('change', () => {
      currentContent = editor.getValue();
      updatePreview(currentContent);
      updateWordCount(currentContent);
    });
    
    // Listen for file open events
    window.api.onFileOpened((event, data) => {
      currentContent = data.content;
      currentFilePath = data.filePath;
      
      // Set editor content
      editor.setValue(currentContent);
      
      // Ensure preview is updated
      updatePreview(currentContent);
      updateWordCount(currentContent);
      
      // Update file info in status bar
      updateFileInfo(currentFilePath);
      
      // Clear last unsaved content since we now have a file open
      localStorage.removeItem('lastUnsavedContent');
    });
    
    // Listen for save file events
    window.api.onSaveFile(() => {
      window.api.saveFileContent(currentContent);
    });
    
    // Listen for toggle preview events from the menu
    window.api.onTogglePreview(() => {
      togglePreview();
    });
    
    // Update the preview with the markdown content
    function updatePreview(markdown) {
      const preview = document.getElementById('preview');
      
      // Convert markdown to HTML with marked.js
      const rawHtml = marked.parse(markdown);
      
      // Sanitize the HTML to prevent XSS attacks
      const cleanHtml = DOMPurify.sanitize(rawHtml, {
        USE_PROFILES: { html: true },
        ADD_ATTR: ['checked']
      });
      
      // Set the sanitized HTML to the preview
      preview.innerHTML = cleanHtml;
      
      // Add checkbox functionality for task lists
      const checkboxes = preview.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
          // Find the corresponding text in the editor and update it
          const lineText = editor.getValue().split('\n');
          for (let i = 0; i < lineText.length; i++) {
            if (lineText[i].includes('[ ]') && !checkbox.checked) {
              lineText[i] = lineText[i].replace('[ ]', '[x]');
              editor.setValue(lineText.join('\n'));
              break;
            } else if (lineText[i].includes('[x]') && checkbox.checked) {
              lineText[i] = lineText[i].replace('[x]', '[ ]');
              editor.setValue(lineText.join('\n'));
              break;
            }
          }
        });
      });
    }
    
    // Update word count in status bar
    function updateWordCount(text) {
      const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
      document.getElementById('word-count').textContent = `${wordCount} word${wordCount !== 1 ? 's' : ''}`;
    }
    
    // Update file info in status bar
    function updateFileInfo(filePath) {
      const fileInfoElement = document.getElementById('file-info');
      if (filePath) {
        // Extract only the filename from the full path
        const parts = filePath.split(/[\/\\]/);
        const fileName = parts[parts.length - 1];
        fileInfoElement.textContent = fileName;
      } else {
        fileInfoElement.textContent = 'Untitled';
      }
    }
    
    // Toolbar button click handlers
    document.getElementById('btn-h1').addEventListener('click', () => insertMarkdown('# ', ''));
    document.getElementById('btn-h2').addEventListener('click', () => insertMarkdown('## ', ''));
    document.getElementById('btn-h3').addEventListener('click', () => insertMarkdown('### ', ''));
    document.getElementById('btn-bold').addEventListener('click', () => insertMarkdown('**', '**'));
    document.getElementById('btn-italic').addEventListener('click', () => insertMarkdown('*', '*'));
    document.getElementById('btn-code').addEventListener('click', () => {
      const selection = editor.getSelection();
      if (selection.includes('\n')) {
        insertMarkdown('```\n', '\n```');
      } else {
        insertMarkdown('`', '`');
      }
    });
    document.getElementById('btn-link').addEventListener('click', () => insertMarkdown('[', '](url)'));
    document.getElementById('btn-image').addEventListener('click', () => insertMarkdown('![alt text](', ')'));
    document.getElementById('btn-quote').addEventListener('click', () => insertMarkdown('> ', ''));
    document.getElementById('btn-ul').addEventListener('click', () => insertMarkdown('- ', ''));
    document.getElementById('btn-ol').addEventListener('click', () => insertMarkdown('1. ', ''));
    document.getElementById('btn-task').addEventListener('click', () => insertMarkdown('- [ ] ', ''));
    document.getElementById('btn-hr').addEventListener('click', () => insertMarkdown('---\n', ''));
    
    // Table insertion
    document.getElementById('btn-table').addEventListener('click', () => {
      const tableTemplate = 
        '| Header 1 | Header 2 | Header 3 |\n' +
        '| -------- | -------- | -------- |\n' +
        '| Cell 1   | Cell 2   | Cell 3   |\n' +
        '| Cell 4   | Cell 5   | Cell 6   |\n';
      
      insertMarkdown(tableTemplate, '');
    });
    
    // Function to insert markdown with cursor placement
    function insertMarkdown(before, after) {
      const cursor = editor.getCursor();
      const selection = editor.getSelection();
      
      if (selection === '') {
        // No selection, just insert the markdown at cursor position
        editor.replaceSelection(before + after);
        
        // Place cursor between the before and after text
        editor.setCursor({
          line: cursor.line,
          ch: cursor.ch + before.length
        });
      } else {
        // Wrap the selection with the markdown
        editor.replaceSelection(before + selection + after);
        
        // Set cursor after the inserted text
        if (after === '') {
          editor.setCursor({
            line: cursor.line,
            ch: cursor.ch + before.length + selection.length
          });
        }
      }
      
      // Focus back on the editor
      editor.focus();
    }
    
    // Theme toggle functionality
    document.getElementById('toggle-theme').addEventListener('click', () => {
      const html = document.documentElement;
      const currentTheme = html.getAttribute('data-theme');
      
      if (currentTheme === 'light') {
        html.removeAttribute('data-theme');
        localStorage.setItem('theme', 'dark');
      } else {
        html.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
      }
    });
  });