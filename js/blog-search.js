(function () {
  'use strict';

  var root = document.querySelector('[data-blog-search]');
  var openButtons = document.querySelectorAll('[data-search-open]');
  if (!root || !openButtons.length) return;

  var input = root.querySelector('.blog-search-input');
  var resultsContainer = root.querySelector('[data-search-results]');
  var status = root.querySelector('[data-search-status]');
  var closeButtons = root.querySelectorAll('[data-search-close]');
  var indexUrl = root.getAttribute('data-index-url');
  var posts = null;
  var loadPromise = null;
  var renderedResults = [];
  var selectedIndex = -1;
  var lastFocused = null;
  var debounceTimer = null;

  function normalize(value) {
    var text = String(value || '').toLowerCase();
    if (text.normalize) text = text.normalize('NFKC');
    return text.replace(/\s+/g, ' ').trim();
  }

  function tokensFor(query) {
    var seen = {};
    return normalize(query).split(' ').filter(function (token) {
      if (!token || seen[token]) return false;
      seen[token] = true;
      return true;
    });
  }

  function preparePost(post) {
    var tags = Array.isArray(post.tags) ? post.tags : (post.tags ? [post.tags] : []);
    post.tags = tags;
    post._title = normalize(post.title);
    post._description = normalize(post.description);
    post._content = normalize(post.content);
    post._category = normalize(post.category);
    post._date = normalize(post.date);
    post._tags = tags.map(normalize);
    return post;
  }

  function fieldScore(value, token, exact, prefix, contains) {
    if (!value) return 0;
    if (value === token) return exact;
    if (value.indexOf(token) === 0) return prefix;
    return value.indexOf(token) > -1 ? contains : 0;
  }

  function scorePost(post, tokens, phrase) {
    var score = 0;

    for (var i = 0; i < tokens.length; i += 1) {
      var token = tokens[i];
      var tokenScore = 0;
      tokenScore += fieldScore(post._title, token, 180, 120, 82);
      tokenScore += fieldScore(post._description, token, 52, 42, 34);
      tokenScore += fieldScore(post._category, token, 72, 58, 46);
      tokenScore += fieldScore(post._date, token, 40, 28, 18);

      for (var tagIndex = 0; tagIndex < post._tags.length; tagIndex += 1) {
        tokenScore += fieldScore(post._tags[tagIndex], token, 105, 82, 64);
      }

      if (post._content.indexOf(token) > -1) tokenScore += 12;
      if (!tokenScore) return -1;
      score += tokenScore;
    }

    if (phrase) {
      if (post._title.indexOf(phrase) > -1) score += 90;
      if (post._description.indexOf(phrase) > -1) score += 35;
      if (post._content.indexOf(phrase) > -1) score += 10;
    }

    return score;
  }

  function search(query) {
    var tokens = tokensFor(query);
    var phrase = normalize(query);
    if (!tokens.length || !posts) return [];

    return posts.map(function (post) {
      return { post: post, score: scorePost(post, tokens, phrase) };
    }).filter(function (item) {
      return item.score >= 0;
    }).sort(function (left, right) {
      if (right.score !== left.score) return right.score - left.score;
      return String(right.post.date).localeCompare(String(left.post.date));
    }).slice(0, 20);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlight(value, tokens) {
    var text = String(value || '');
    if (!tokens.length) return escapeHtml(text);

    var pattern = tokens.slice().sort(function (a, b) {
      return b.length - a.length;
    }).map(escapeRegExp).join('|');

    if (!pattern) return escapeHtml(text);
    var matcher = new RegExp('(' + pattern + ')', 'gi');
    var lastIndex = 0;
    var output = '';
    var match;

    while ((match = matcher.exec(text)) !== null) {
      output += escapeHtml(text.slice(lastIndex, match.index));
      output += '<mark>' + escapeHtml(match[0]) + '</mark>';
      lastIndex = match.index + match[0].length;
      if (!match[0].length) matcher.lastIndex += 1;
    }

    return output + escapeHtml(text.slice(lastIndex));
  }

  function snippetFor(post, tokens) {
    var source = post.description || post.content || '';
    var normalizedSource = normalize(source);
    var firstMatch = -1;

    tokens.forEach(function (token) {
      var index = normalizedSource.indexOf(token);
      if (index > -1 && (firstMatch === -1 || index < firstMatch)) firstMatch = index;
    });

    var start = firstMatch > 55 ? firstMatch - 55 : 0;
    var snippet = source.slice(start, start + 170);
    if (start > 0) snippet = '…' + snippet;
    if (start + 170 < source.length) snippet += '…';
    return snippet;
  }

  function setSelection(nextIndex) {
    var links = resultsContainer.querySelectorAll('.blog-search-result');
    if (!links.length) {
      selectedIndex = -1;
      return;
    }

    selectedIndex = (nextIndex + links.length) % links.length;
    Array.prototype.forEach.call(links, function (link, index) {
      var selected = index === selectedIndex;
      link.classList.toggle('is-selected', selected);
      link.setAttribute('aria-selected', selected ? 'true' : 'false');
      if (selected) link.scrollIntoView({ block: 'nearest' });
    });
  }

  function render(query) {
    var tokens = tokensFor(query);
    selectedIndex = -1;
    resultsContainer.innerHTML = '';

    if (!tokens.length) {
      renderedResults = [];
      status.textContent = posts ? '已收录 ' + posts.length + ' 篇文章' : '输入关键词开始搜索';
      return;
    }

    renderedResults = search(query);
    status.textContent = '找到 ' + renderedResults.length + ' 篇相关文章' + (renderedResults.length === 20 ? '，显示前 20 条' : '');

    if (!renderedResults.length) {
      resultsContainer.innerHTML = '<div class="blog-search-empty">没有找到相关文章，试试更短的关键词或标签。</div>';
      return;
    }

    renderedResults.forEach(function (item, index) {
      var post = item.post;
      var link = document.createElement('a');
      var tags = post.tags.slice(0, 4);
      link.className = 'blog-search-result';
      link.href = post.url;
      link.setAttribute('role', 'option');
      link.setAttribute('aria-selected', 'false');
      link.setAttribute('data-result-index', String(index));
      link.innerHTML =
        '<h3 class="blog-search-result-title">' + highlight(post.title, tokens) + '</h3>' +
        '<div class="blog-search-result-meta">' +
          '<span>' + escapeHtml(post.date) + '</span>' +
          (tags.length ? '<span class="blog-search-result-tags">' + highlight(tags.join(' · '), tokens) + '</span>' : '') +
        '</div>' +
        '<p class="blog-search-result-snippet">' + highlight(snippetFor(post, tokens), tokens) + '</p>';
      link.addEventListener('mouseenter', function () {
        setSelection(index);
      });
      resultsContainer.appendChild(link);
    });
  }

  function loadIndex() {
    if (loadPromise) return loadPromise;

    status.textContent = '正在加载文章索引…';
    loadPromise = fetch(indexUrl, { credentials: 'same-origin' })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        posts = data.map(preparePost);
        render(input.value);
        return posts;
      })
      .catch(function (error) {
        loadPromise = null;
        status.textContent = '搜索索引加载失败，请稍后重试';
        resultsContainer.innerHTML = '<div class="blog-search-empty">暂时无法加载搜索内容。</div>';
        throw error;
      });

    return loadPromise;
  }

  function openSearch() {
    if (!root.hidden) return;
    lastFocused = document.activeElement;
    root.hidden = false;
    document.body.classList.add('blog-search-open');
    input.focus();
    input.select();
    loadIndex().catch(function () {});
  }

  function closeSearch() {
    if (root.hidden) return;
    root.hidden = true;
    document.body.classList.remove('blog-search-open');
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  Array.prototype.forEach.call(openButtons, function (button) {
    button.addEventListener('click', openSearch);
  });

  Array.prototype.forEach.call(closeButtons, function (button) {
    button.addEventListener('click', closeSearch);
  });

  input.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      if (posts) render(input.value);
    }, 180);
  });

  input.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelection(selectedIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelection(selectedIndex < 0 ? renderedResults.length - 1 : selectedIndex - 1);
    } else if (event.key === 'Enter' && renderedResults.length) {
      event.preventDefault();
      var targetIndex = selectedIndex < 0 ? 0 : selectedIndex;
      var target = resultsContainer.querySelector('[data-result-index="' + targetIndex + '"]');
      if (target) window.location.href = target.href;
    }
  });

  document.addEventListener('keydown', function (event) {
    var target = event.target;
    var isEditing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    if (event.key === 'Escape' && !root.hidden) {
      event.preventDefault();
      closeSearch();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openSearch();
      return;
    }

    if (event.key === '/' && !isEditing && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      openSearch();
    }
  });
})();
