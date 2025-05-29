// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize variables
    let editor;
    let currentContent = '';
    let currentFilePath = null;
    
    // Menu functionality
    const menuBtn = document.getElementById('menu-btn');
    const menuDropdown = document.getElementById('menu-dropdown');
    const viewBtn = document.getElementById('view-btn');
    const viewDropdown = document.getElementById('view-dropdown');
    const previewSection = document.querySelector('.preview-section');
    
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
    
    // Toggle preview functionality
    document.getElementById('toggle-preview').addEventListener('click', () => {
        previewSection.classList.toggle('hidden');
        viewDropdown.classList.remove('show');
        // If preview is hidden, make editor take full width
        const editorSection = document.querySelector('.editor-section');
        editorSection.style.width = previewSection.classList.contains('hidden') ? '100%' : '';
        // Trigger a refresh on the editor to ensure proper rendering
        editor.refresh();
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
        }
      }
    });
    
    // Initialize preview with empty content
    updatePreview('');
    
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
      
      // Update file info in status bar
      updateFileInfo(currentFilePath);
    });
    
    // Listen for save file events
    window.api.onSaveFile(() => {
      window.api.saveFileContent(currentContent);
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
      } else {
        html.setAttribute('data-theme', 'light');
      }
    });
  });