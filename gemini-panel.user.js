// ==UserScript==
// @name         Gemini 增强面板 (Gemini Pro Panel)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  为 Google Gemini 添加历史对话索引、Prompt 收藏、智能隐藏
// @author       Chantec
// @match        https://gemini.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        none
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // --- 1. 样式表 (保持你满意的外观) ---
    const styles = `
        #gemini-nav-sidebar {
            position: fixed; box-sizing: border-box;
            background: #ffffff !important;
            border: 1px solid #e3e3e3;
            box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.15);
            border-radius: 24px; /* V4 大圆角 */
            z-index: 99999; display: flex; flex-direction: column;
            font-family: 'Google Sans', Roboto, Segoe UI, sans-serif;
            overflow: hidden;
            max-width: 98vw; max-height: 98vh;
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                        height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                        left 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                        top 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                        border-radius 0.3s, opacity 0.3s, box-shadow 0.3s;
        }

        #gemini-nav-sidebar.no-transition { transition: none !important; }

        .query-text { scroll-margin-top: 120px !important; }

        /* --- 隐藏状态 --- */
        #gemini-nav-sidebar.collapsed { cursor: pointer; border: 1px solid #ddd; opacity: 0.95; }
        #gemini-nav-sidebar.collapsed > *:not(#gemini-collapsed-icon) { display: none !important; }

        #gemini-nav-sidebar.collapsed:not([class*="snapped-"]) {
            width: 48px !important; height: 48px !important;
            border-radius: 50% !important; background: #ffffff !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        #gemini-collapsed-icon {
            display: none; flex-direction: column; align-items: center; justify-content: center;
            width: 100%; height: 100%; gap: 3px;
        }
        #gemini-nav-sidebar.collapsed:not([class*="snapped-"]) #gemini-collapsed-icon { display: flex; }
        .menu-line { width: 16px; height: 2px; background: #5f6368; border-radius: 1px; }

        /* 边缘吸附 */
        #gemini-nav-sidebar.collapsed.snapped-left {
            width: 8px !important; border-radius: 0 8px 8px 0 !important;
            left: 0 !important; border-left: none; background: #ffffff !important;
            box-shadow: 2px 0 5px rgba(0,0,0,0.08);
        }
        #gemini-nav-sidebar.collapsed.snapped-right {
            width: 8px !important; border-radius: 8px 0 0 8px !important;
            left: calc(100vw - 8px) !important; border-right: none; background: #ffffff !important;
            box-shadow: -2px 0 5px rgba(0,0,0,0.08);
        }

        /* --- 列表项 --- */
        .gemini-nav-item {
            position: relative; display: block;
            padding: 8px 12px; margin: 2px 4px;
            font-size: 13px; color: #1e1e1e; cursor: pointer;
            border-radius: 12px; transition: background 0.2s; overflow: hidden;
        }
        .gemini-nav-item:hover { background: #f0f4f9; }

        .item-text {
            display: block; width: 100%;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            pointer-events: none; transition: color 0.2s;
        }
        .gemini-nav-item:hover .item-text { color: #1a73e8; }

        .action-btn {
            position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
            opacity: 0; cursor: pointer; font-size: 12px;
            width: 24px; height: 24px; line-height: 24px; text-align: center;
            background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(2px);
            border-radius: 50%; box-shadow: -2px 0 8px rgba(0,0,0,0.1);
            transition: opacity 0.2s, transform 0.2s; z-index: 10;
        }
        .gemini-nav-item:hover .action-btn { opacity: 1; }
        .action-btn:hover { background: #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.15); transform: translateY(-50%) scale(1.1); }

        /* --- 头部与布局 --- */
        #gemini-nav-header { padding: 16px 16px 10px 16px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; cursor: move; }

        #gemini-nav-lock { width: 10px; height: 10px; border-radius: 50%; background: #d1d1d1; cursor: pointer; border: 2px solid #fff; box-shadow: 0 0 0 1px #e3e3e3; transition: 0.2s; }
        #gemini-nav-lock:hover { transform: scale(1.2); }
        #gemini-nav-lock.active { background: #1a73e8; box-shadow: 0 0 0 1px #1a73e8; }

        #gemini-nav-tabs { display: flex; background: #f0f4f9; padding: 2px; border-radius: 20px; }
        .nav-tab { padding: 3px 12px; font-size: 12px; cursor: pointer; color: #444746; border-radius: 18px; transition: 0.2s; }
        .nav-tab.active { color: #1a73e8; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); font-weight: 500; }

        #gemini-nav-content-wrapper { flex-grow: 1; overflow-y: auto; padding: 4px 6px; }
        .content-panel { display: none; }
        .content-panel.active { display: block; }

        /* --- 搜索框 (完美对称版) --- */
        #gemini-nav-search-container { padding: 4px 16px 8px 16px; }
        #gemini-nav-search-input {
            width: 100%; box-sizing: border-box;
            padding: 9px 14px; background: #f0f4f9; border: 1px solid transparent;
            border-radius: 20px; font-size: 13px; outline: none; transition: all 0.2s;
        }
        #gemini-nav-search-input:focus {
            background: #ffffff; border-color: #1a73e8;
            box-shadow: 0 1px 4px rgba(26,115,232,0.2);
        }

        .resizer { position: absolute; width: 14px; height: 14px; z-index: 10001; }
        .resizer-tl { top: 0; left: 0; cursor: nw-resize; }
        .resizer-tr { top: 0; right: 0; cursor: ne-resize; }
        .resizer-bl { bottom: 0; left: 0; cursor: sw-resize; }
        .resizer-br { bottom: 0; right: 0; cursor: se-resize; }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    // --- 2. 构造 DOM ---
    const sidebar = document.createElement('div');
    sidebar.id = 'gemini-nav-sidebar';

    const collapsedIcon = document.createElement('div');
    collapsedIcon.id = 'gemini-collapsed-icon';
    [1, 2, 3].forEach(() => {
        const line = document.createElement('span');
        line.className = 'menu-line';
        collapsedIcon.appendChild(line);
    });

    const header = document.createElement('div');
    header.id = 'gemini-nav-header';
    const lockBtn = document.createElement('div');
    lockBtn.id = 'gemini-nav-lock';
    lockBtn.title = '点击切换：绿色为固定，灰色为自动隐藏';

    const tabsContainer = document.createElement('div');
    tabsContainer.id = 'gemini-nav-tabs';
    const tabNav = document.createElement('div');
    tabNav.className = 'nav-tab active';
    tabNav.textContent = '目录';
    tabNav.dataset.target = 'panel-nav';
    const tabFav = document.createElement('div');
    tabFav.className = 'nav-tab';
    tabFav.textContent = '收藏';
    tabFav.dataset.target = 'panel-fav';
    tabsContainer.append(tabNav, tabFav);
    header.append(lockBtn, tabsContainer);

    const searchContainer = document.createElement('div');
    searchContainer.id = 'gemini-nav-search-container';
    const searchInput = document.createElement('input');
    searchInput.id = 'gemini-nav-search-input';
    searchInput.placeholder = '搜索...';
    searchContainer.append(searchInput);

    const contentWrapper = document.createElement('div');
    contentWrapper.id = 'gemini-nav-content-wrapper';
    const panelNav = document.createElement('div');
    panelNav.id = 'panel-nav';
    panelNav.className = 'content-panel active';
    const panelFav = document.createElement('div');
    panelFav.id = 'panel-fav';
    panelFav.className = 'content-panel';
    contentWrapper.append(panelNav, panelFav);

    const resizers = ['tl', 'tr', 'bl', 'br'].map(pos => {
        const el = document.createElement('div');
        el.className = `resizer resizer-${pos}`;
        el.dataset.pos = pos;
        return el;
    });

    sidebar.append(collapsedIcon, header, searchContainer, contentWrapper, ...resizers);
    document.body.appendChild(sidebar);

    // --- 3. 业务逻辑 (修复搜索功能) ---
    let favorites = JSON.parse(localStorage.getItem('gemini-favorites')) || [];
    const saveFavorites = () => localStorage.setItem('gemini-favorites', JSON.stringify(favorites));
    let isAutoHideEnabled = JSON.parse(localStorage.getItem('gemini-auto-hide')) ?? true;
    let autoHideTimer = null;

    function updateLockUI() { lockBtn.classList.toggle('active', !isAutoHideEnabled); }
    updateLockUI();

    lockBtn.onclick = (e) => {
        e.stopPropagation();
        isAutoHideEnabled = !isAutoHideEnabled;
        localStorage.setItem('gemini-auto-hide', isAutoHideEnabled);
        updateLockUI();
        if (!isAutoHideEnabled) { clearTimeout(autoHideTimer); sidebar.classList.remove('collapsed'); }
    };

    // 【核心修复】搜索监听逻辑
    searchInput.oninput = () => {
        const q = searchInput.value.toLowerCase();
        // 获取当前激活的面板 (Nav 或 Fav)
        const activePanelId = document.querySelector('.nav-tab.active').dataset.target;
        const activePanel = document.getElementById(activePanelId);

        if (activePanel) {
            activePanel.querySelectorAll('.gemini-nav-item').forEach(item => {
                const text = item.querySelector('.item-text').textContent.toLowerCase();
                item.style.display = text.includes(q) ? 'block' : 'none';
            });
        }
    };

    function fillInput(text) {
        const inputEl = document.querySelector('div[role="textbox"]') || document.querySelector('div[contenteditable="true"]') || document.querySelector('textarea');
        if (inputEl) {
            inputEl.focus();
            document.execCommand('selectAll', false, null);
            document.execCommand('insertText', false, text);
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    function renderFavorites() {
        if (!panelFav.classList.contains('active')) return;
        panelFav.replaceChildren();
        if (favorites.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:#747775;text-align:center;margin-top:20px;font-size:12px;';
            empty.textContent = '暂无收藏 Prompt';
            panelFav.append(empty);
            return;
        }
        favorites.forEach((fav, i) => {
            const item = document.createElement('div');
            item.className = 'gemini-nav-item';
            const txt = document.createElement('span');
            txt.className = 'item-text';
            txt.textContent = fav;
            item.onclick = () => fillInput(fav);
            const delBtn = document.createElement('span');
            delBtn.className = 'action-btn';
            delBtn.textContent = '🗑️';
            delBtn.onclick = (e) => { e.stopPropagation(); favorites.splice(i, 1); saveFavorites(); renderFavorites(); };
            item.append(txt, delBtn);
            panelFav.append(item);
        });
        // 重新渲染后应用当前的搜索过滤（如果存在）
        if (searchInput.value) searchInput.dispatchEvent(new Event('input'));
    }

    let lastCount = -1;
    function refreshNav() {
        if (!panelNav.classList.contains('active')) return;
        const blocks = document.querySelectorAll('.query-text');
        if (blocks.length === lastCount) return;
        lastCount = blocks.length;

        panelNav.replaceChildren();

        blocks.forEach((block, index) => {
            const content = block.innerText.replace(/\n+/g, ' ').trim();
            if (!content) return;

            const item = document.createElement('div');
            item.className = 'gemini-nav-item';
            const txt = document.createElement('span');
            txt.className = 'item-text';
            txt.textContent = `${index + 1}. ${content}`;

            item.onclick = (e) => {
                e.stopPropagation();
                // 实时查询 DOM 确保点击有效
                const currentBlocks = document.querySelectorAll('.query-text');
                const targetBlock = currentBlocks[index];

                if (targetBlock) {
                    targetBlock.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    const originalTransition = targetBlock.style.transition;
                    targetBlock.style.transition = 'background 0.5s';
                    targetBlock.style.background = 'rgba(26, 115, 232, 0.15)';
                    setTimeout(() => {
                        targetBlock.style.background = '';
                        targetBlock.style.transition = originalTransition;
                    }, 800);
                }
            };

            const favBtn = document.createElement('span');
            favBtn.className = 'action-btn';
            favBtn.textContent = '⭐';
            favBtn.onclick = (e) => {
                e.stopPropagation();
                if (!favorites.includes(content)) {
                    favorites.unshift(content); saveFavorites(); favBtn.textContent = '✅';
                    setTimeout(() => favBtn.textContent = '⭐', 1000);
                }
            };
            item.append(txt, favBtn);
            panelNav.append(item);
        });
        // 重新渲染后应用当前的搜索过滤（如果存在）
        if (searchInput.value) searchInput.dispatchEvent(new Event('input'));
    }

    // --- 4. 交互逻辑 ---
    function applyMagneticSnapping() {
        const threshold = 60;
        const rect = sidebar.getBoundingClientRect();
        const winW = window.innerWidth;
        sidebar.classList.remove('snapped-left', 'snapped-right');
        if (rect.left < threshold) {
            sidebar.style.left = '0px'; sidebar.classList.add('snapped-left');
        } else if (winW - rect.right < threshold) {
            sidebar.style.left = (winW - sidebar.offsetWidth) + 'px'; sidebar.classList.add('snapped-right');
        }
        if (!sidebar.classList.contains('collapsed')) {
            localStorage.setItem('gemini-nav-config', JSON.stringify({
                left: sidebar.style.left, top: sidebar.style.top,
                width: sidebar.style.width, height: sidebar.style.height
            }));
        }
    }

    sidebar.addEventListener('mouseenter', () => { if (isAutoHideEnabled) { clearTimeout(autoHideTimer); sidebar.classList.remove('collapsed'); } });
    sidebar.addEventListener('mouseleave', () => {
        if (isAutoHideEnabled && !isDragging && !activeResizer) {
            autoHideTimer = setTimeout(() => { sidebar.classList.add('collapsed'); applyMagneticSnapping(); }, 600);
        }
    });

    let isDragging = false, activeResizer = null, rafId = null;
    let startX, startY, initialLeft, initialTop, initialWidth, initialHeight;

    sidebar.addEventListener('mousedown', (e) => {
        const target = e.target;
        if (target.tagName === 'INPUT' || target.classList.contains('action-btn') || target.id === 'gemini-nav-lock') return;
        startX = e.clientX; startY = e.clientY;
        initialLeft = sidebar.offsetLeft; initialTop = sidebar.offsetTop;
        initialWidth = sidebar.offsetWidth; initialHeight = sidebar.offsetHeight;
        if (target.classList.contains('resizer')) {
            activeResizer = target.dataset.pos; sidebar.classList.add('no-transition'); e.preventDefault();
        } else if (target.closest('#gemini-nav-header') || sidebar.classList.contains('collapsed')) {
            isDragging = true; sidebar.classList.add('no-transition'); e.preventDefault();
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging && !activeResizer) return;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            const dx = e.clientX - startX; const dy = e.clientY - startY;
            if (isDragging) { sidebar.style.left = (initialLeft + dx) + 'px'; sidebar.style.top = (initialTop + dy) + 'px'; }
            else if (activeResizer) {
                let newW = initialWidth, newH = initialHeight, newL = initialLeft, newT = initialTop;
                const minSize = 150;
                if (activeResizer.includes('r')) newW = Math.max(minSize, initialWidth + dx);
                if (activeResizer.includes('b')) newH = Math.max(minSize, initialHeight + dy);
                if (activeResizer.includes('l')) { newW = Math.max(minSize, initialWidth - dx); if (newW > minSize) newL = initialLeft + dx; }
                if (activeResizer.includes('t')) { newH = Math.max(minSize, initialHeight - dy); if (newH > minSize) newT = initialTop + dy; }
                sidebar.style.width = newW + 'px'; sidebar.style.height = newH + 'px';
                sidebar.style.left = newL + 'px'; sidebar.style.top = newT + 'px';
            }
        });
    });

    window.addEventListener('mouseup', () => {
        if (isDragging || activeResizer) { sidebar.classList.remove('no-transition'); if (isDragging) applyMagneticSnapping(); isDragging = false; activeResizer = null; }
    });

    // --- 5. 初始化 ---
    [tabNav, tabFav].forEach(tab => {
        tab.onclick = (e) => {
            e.stopPropagation();
            // 切换标签时清空搜索，避免混淆
            searchInput.value = '';
            [tabNav, tabFav].forEach(t => t.classList.remove('active')); tab.classList.add('active');
            [panelNav, panelFav].forEach(p => p.classList.remove('active'));
            document.getElementById(tab.dataset.target).classList.add('active');
            tab.dataset.target === 'panel-fav' ? renderFavorites() : refreshNav();
        };
    });

    const saved = JSON.parse(localStorage.getItem('gemini-nav-config')) || {};
    sidebar.style.left = saved.left || 'auto'; if (!saved.left) sidebar.style.right = '24px';
    sidebar.style.top = saved.top || '20%'; sidebar.style.width = saved.width || '240px'; sidebar.style.height = saved.height || '400px';

    const observer = new MutationObserver(() => {
        clearTimeout(window.geminiRefreshTimer);
        window.geminiRefreshTimer = setTimeout(() => { refreshNav(); renderFavorites(); }, 800);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(applyMagneticSnapping, 500); setTimeout(refreshNav, 1500);
})();