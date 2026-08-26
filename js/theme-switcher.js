(function () {
    'use strict';

    var STORAGE_KEY = 'jamie-blog-theme';
    var THEMES = ['classic', 'eye', 'dark'];
    var THEME_INFO = {
        classic: { label: '经典', icon: '◐', color: '#ffffff' },
        eye: { label: '护眼', icon: '☕', color: '#f6f1e7' },
        dark: { label: '深色', icon: '☾', color: '#14181d' }
    };

    var root = document.documentElement;
    var toggle = document.querySelector('[data-theme-toggle]');
    var floatingTools = document.querySelector('[data-floating-tools]');
    var floatingToolsToggle = document.querySelector('[data-floating-tools-toggle]');
    var label = document.querySelector('[data-theme-label]');
    var icon = document.querySelector('[data-theme-icon]');
    var themeColor = document.querySelector('meta[name="theme-color"]');
    var systemTheme = window.matchMedia
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
    var idleTimer = null;
    var AUTO_COLLAPSE_DELAY = 3000;
    var POSITION_KEY = 'jamie-blog-tools-position';
    var savedPosition = null;
    var SNAP_DISTANCE = 56;
    var VIEWPORT_MARGIN = 12;
    var EDGE_FAN_MARGIN = 64;
    var dragPointerId = null;
    var dragOffsetX = 0;
    var dragOffsetY = 0;
    var pointerInHandleX = 0;
    var pointerInHandleY = 0;
    var dragStartX = 0;
    var dragStartY = 0;
    var dragLastX = 0;
    var dragLastY = 0;
    var didDrag = false;

    function readSavedTheme() {
        try {
            var saved = localStorage.getItem(STORAGE_KEY);
            return THEMES.indexOf(saved) > -1 ? saved : null;
        } catch (error) {
            return null;
        }
    }

    function saveTheme(theme) {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (error) {}
    }

    function getTheme() {
        var current = root.getAttribute('data-theme');
        return THEMES.indexOf(current) > -1 ? current : 'classic';
    }

    function renderTheme(theme) {
        var info = THEME_INFO[theme];
        var nextTheme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];

        root.setAttribute('data-theme', theme);
        root.style.colorScheme = theme === 'dark' ? 'dark' : 'light';

        if (label) label.textContent = info.label;
        if (icon) icon.textContent = info.icon;
        if (themeColor) themeColor.setAttribute('content', info.color);
        if (toggle) {
            toggle.setAttribute('aria-label', '当前主题：' + info.label + '，点击切换到' + THEME_INFO[nextTheme].label);
            toggle.setAttribute('title', '当前主题：' + info.label);
        }
    }

    function setToolsCollapsed(collapsed) {
        if (!floatingTools) return;
        var edge = getToolsEdge();
        var handleCenter = edge ? null : getHandleCenter();
        floatingTools.classList.toggle('is-collapsed', collapsed);

        if (handleCenter) placeFreeToolsByHandleCenter(handleCenter.x, handleCenter.y);

        if (floatingToolsToggle) {
            floatingToolsToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            floatingToolsToggle.setAttribute(
                'aria-label',
                (collapsed ? '展开快捷工具' : '收起快捷工具') + '，可拖动调整位置'
            );
            floatingToolsToggle.setAttribute(
                'title',
                (collapsed ? '点击展开' : '点击收起') + '，拖动调整位置'
            );
        }
    }

    function scheduleCollapse() {
        if (!floatingTools) return;
        clearTimeout(idleTimer);
        if (floatingTools.classList.contains('is-collapsed')) return;
        idleTimer = setTimeout(function () {
            setToolsCollapsed(true);
        }, AUTO_COLLAPSE_DELAY);
    }

    function collapseToolsImmediately() {
        if (!floatingTools) return;
        clearTimeout(idleTimer);
        if (floatingTools.classList.contains('is-collapsed')) return;
        setToolsCollapsed(true);
    }

    function collapseToolsOnOutsideInteraction(event) {
        if (!floatingTools || floatingTools.contains(event.target)) return;
        collapseToolsImmediately();
    }

    function expandTools() {
        if (!floatingTools) return;
        setToolsCollapsed(false);
        scheduleCollapse();
    }

    function clamp(value, minimum, maximum) {
        return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
    }

    function getToolsEdge() {
        if (floatingTools.classList.contains('edge-left')) return 'left';
        if (floatingTools.classList.contains('edge-right')) return 'right';
        if (floatingTools.classList.contains('edge-top')) return 'top';
        if (floatingTools.classList.contains('edge-bottom')) return 'bottom';
        return null;
    }

    function setToolsEdge(edge) {
        floatingTools.classList.remove('edge-left', 'edge-right', 'edge-top', 'edge-bottom');
        if (edge) floatingTools.classList.add('edge-' + edge);

        if (edge === 'left') {
            floatingTools.style.left = '0';
            floatingTools.style.right = 'auto';
            floatingTools.style.bottom = 'auto';
        } else if (edge === 'right') {
            floatingTools.style.left = 'auto';
            floatingTools.style.right = '0';
            floatingTools.style.bottom = 'auto';
        } else if (edge === 'top') {
            floatingTools.style.top = '0';
            floatingTools.style.right = 'auto';
            floatingTools.style.bottom = 'auto';
        } else if (edge === 'bottom') {
            floatingTools.style.top = 'auto';
            floatingTools.style.right = 'auto';
            floatingTools.style.bottom = '0';
        } else {
            floatingTools.style.right = 'auto';
            floatingTools.style.bottom = 'auto';
        }
    }

    function applyFreeToolsPosition(left, top) {
        setToolsEdge(null);
        var rect = floatingTools.getBoundingClientRect();
        var maximumLeft = window.innerWidth - rect.width - VIEWPORT_MARGIN;
        var maximumTop = window.innerHeight - rect.height - VIEWPORT_MARGIN;
        floatingTools.style.left = clamp(left, VIEWPORT_MARGIN, maximumLeft) + 'px';
        floatingTools.style.top = clamp(top, VIEWPORT_MARGIN, maximumTop) + 'px';
    }

    function applyEdgeToolsPosition(edge, position) {
        setToolsEdge(edge);
        var rect = floatingTools.getBoundingClientRect();
        if (edge === 'left' || edge === 'right') {
            var maximumTop = window.innerHeight - rect.height - EDGE_FAN_MARGIN;
            floatingTools.style.top = clamp(position, EDGE_FAN_MARGIN, maximumTop) + 'px';
        } else {
            var maximumLeft = window.innerWidth - rect.width - EDGE_FAN_MARGIN;
            floatingTools.style.left = clamp(position, EDGE_FAN_MARGIN, maximumLeft) + 'px';
        }
    }

    function getHandleCenter() {
        var rect = floatingToolsToggle.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    function placeFreeToolsByHandleCenter(centerX, centerY) {
        var toolsRect = floatingTools.getBoundingClientRect();
        var handleRect = floatingToolsToggle.getBoundingClientRect();
        var offsetX = handleRect.left - toolsRect.left + handleRect.width / 2;
        var offsetY = handleRect.top - toolsRect.top + handleRect.height / 2;
        applyFreeToolsPosition(centerX - offsetX, centerY - offsetY);
    }

    function saveToolsPosition() {
        var center = getHandleCenter();
        savedPosition = {
            edge: getToolsEdge(),
            x: clamp(center.x / window.innerWidth, 0, 1),
            y: clamp(center.y / window.innerHeight, 0, 1)
        };
        try {
            localStorage.setItem(POSITION_KEY, JSON.stringify(savedPosition));
        } catch (error) {}
    }

    function restoreToolsPosition() {
        if (!floatingTools) return;
        try {
            var raw = localStorage.getItem(POSITION_KEY);
            var parsed = raw ? JSON.parse(raw) : null;
            var validEdge = parsed && ['left', 'right', 'top', 'bottom'].indexOf(parsed.edge) > -1;
            var validFreePosition = parsed && parsed.edge === null && parsed.x >= 0 && parsed.x <= 1;
            if (parsed && parsed.y >= 0 && parsed.y <= 1 && (validEdge || validFreePosition)) {
                savedPosition = parsed;
            }
        } catch (error) {}

        if (savedPosition === null) return;
        var centerY = savedPosition.y * window.innerHeight;

        if (savedPosition.edge === 'left' || savedPosition.edge === 'right') {
            var edgeRect = floatingTools.getBoundingClientRect();
            applyEdgeToolsPosition(savedPosition.edge, centerY - edgeRect.height / 2);
        } else if (savedPosition.edge === 'top' || savedPosition.edge === 'bottom') {
            var horizontalEdgeRect = floatingTools.getBoundingClientRect();
            applyEdgeToolsPosition(
                savedPosition.edge,
                savedPosition.x * window.innerWidth - horizontalEdgeRect.width / 2
            );
        } else {
            placeFreeToolsByHandleCenter(
                clamp(savedPosition.x, 0, 1) * window.innerWidth,
                centerY
            );
        }
    }

    function startToolsDrag(event) {
        if (event.button !== undefined && event.button !== 0) return;
        var handleRect = floatingToolsToggle.getBoundingClientRect();
        dragPointerId = event.pointerId;
        pointerInHandleX = clamp((event.clientX - handleRect.left) / handleRect.width, 0, 1);
        pointerInHandleY = clamp((event.clientY - handleRect.top) / handleRect.height, 0, 1);
        dragStartX = event.clientX;
        dragStartY = event.clientY;
        dragLastX = event.clientX;
        dragLastY = event.clientY;
        didDrag = false;
        floatingToolsToggle.setPointerCapture(event.pointerId);
    }

    function moveTools(event) {
        if (event.pointerId !== dragPointerId) return;
        if (!didDrag && Math.hypot(event.clientX - dragStartX, event.clientY - dragStartY) < 5) return;

        dragLastX = event.clientX;
        dragLastY = event.clientY;

        if (!didDrag) {
            didDrag = true;
            clearTimeout(idleTimer);
            floatingTools.classList.add('is-dragging');
            setToolsEdge(null);
            setToolsCollapsed(true);

            var toolsRect = floatingTools.getBoundingClientRect();
            var handleRect = floatingToolsToggle.getBoundingClientRect();
            dragOffsetX = handleRect.left - toolsRect.left + handleRect.width * pointerInHandleX;
            dragOffsetY = handleRect.top - toolsRect.top + handleRect.height * pointerInHandleY;
        }

        applyFreeToolsPosition(event.clientX - dragOffsetX, event.clientY - dragOffsetY);
        event.preventDefault();
    }

    function snapToolsIfNeeded(pointerX, pointerY) {
        var rect = floatingTools.getBoundingClientRect();
        var distances = [
            { edge: 'left', value: pointerX },
            { edge: 'right', value: window.innerWidth - pointerX },
            { edge: 'top', value: pointerY },
            { edge: 'bottom', value: window.innerHeight - pointerY }
        ].sort(function (left, right) {
            return left.value - right.value;
        });
        var nearest = distances[0];

        if (nearest.value <= SNAP_DISTANCE && (nearest.edge === 'left' || nearest.edge === 'right')) {
            applyEdgeToolsPosition(nearest.edge, rect.top);
            return nearest.edge;
        } else if (nearest.value <= SNAP_DISTANCE) {
            applyEdgeToolsPosition(nearest.edge, rect.left);
            return nearest.edge;
        } else {
            applyFreeToolsPosition(rect.left, rect.top);
            return null;
        }
    }

    function finishToolsDrag(event) {
        if (event.pointerId !== dragPointerId) return;
        dragPointerId = null;

        if (didDrag) {
            snapToolsIfNeeded(dragLastX, dragLastY);
            saveToolsPosition();
            clearTimeout(idleTimer);
            setToolsCollapsed(true);
            floatingTools.getBoundingClientRect();
        }

        floatingTools.classList.remove('is-dragging');

        if (event.type === 'pointercancel') didDrag = false;
    }

    if (toggle) {
        toggle.addEventListener('click', function () {
            var current = getTheme();
            var next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
            saveTheme(next);
            renderTheme(next);
        });
    }

    if (systemTheme) {
        var followSystemTheme = function (event) {
            if (!readSavedTheme()) renderTheme(event.matches ? 'dark' : 'classic');
        };

        if (systemTheme.addEventListener) {
            systemTheme.addEventListener('change', followSystemTheme);
        } else if (systemTheme.addListener) {
            systemTheme.addListener(followSystemTheme);
        }
    }

    if (floatingTools) {
        floatingTools.addEventListener('pointerdown', scheduleCollapse);
        floatingTools.addEventListener('pointermove', scheduleCollapse);
        floatingTools.addEventListener('keydown', scheduleCollapse);
        window.addEventListener('scroll', collapseToolsImmediately, { passive: true });
        window.addEventListener('wheel', collapseToolsImmediately, { passive: true });
        window.addEventListener('touchmove', collapseToolsImmediately, { passive: true });
        document.addEventListener('pointerdown', collapseToolsOnOutsideInteraction);
        document.addEventListener('keydown', collapseToolsOnOutsideInteraction);
        window.addEventListener('resize', restoreToolsPosition);
        restoreToolsPosition();
    }

    if (floatingToolsToggle) {
        floatingToolsToggle.addEventListener('pointerdown', startToolsDrag);
        floatingToolsToggle.addEventListener('pointermove', moveTools);
        floatingToolsToggle.addEventListener('pointerup', finishToolsDrag);
        floatingToolsToggle.addEventListener('pointercancel', finishToolsDrag);
        floatingToolsToggle.addEventListener('click', function (event) {
            if (didDrag) {
                didDrag = false;
                event.preventDefault();
                return;
            }
            if (floatingTools.classList.contains('is-collapsed')) {
                expandTools();
            } else {
                clearTimeout(idleTimer);
                setToolsCollapsed(true);
            }
        });
    }

    if (toggle) {
        toggle.addEventListener('click', scheduleCollapse);
    }

    renderTheme(getTheme());
})();
