document.addEventListener('DOMContentLoaded', function () {
    console.log('Popup loaded.');

    const sourceText = document.getElementById('sourceText');
    const translateBtn = document.getElementById('translateBtn');
    const swapBtn = document.getElementById('swapBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const translatedText = document.getElementById('translatedText');
    const resultPlaceholder = document.getElementById('resultPlaceholder');
    const errorMessage = document.getElementById('errorMessage');
    const btnText = document.getElementById('btnText');
    const btnLoading = document.getElementById('btnLoading');
    const historyList = document.getElementById('historyList');
    const mainPanel = document.getElementById('mainPanel');
    const settingsPanel = document.getElementById('settingsPanel');
    const appIdInput = document.getElementById('appId');
    const appKeyInput = document.getElementById('appKey');

    // 加载设置和历史记录
    loadSettings();
    loadHistory();

    // 切换到设置界面
    settingsBtn.addEventListener('click', function () {
        console.log('切换到设置界面');
        mainPanel.style.display = 'none';
        settingsPanel.style.display = 'block';
    });

    // 取消设置
    cancelSettingsBtn.addEventListener('click', function () {
        console.log('取消设置，返回主界面');
        settingsPanel.style.display = 'none';
        mainPanel.style.display = 'block';
    });

    // 保存设置
    saveSettingsBtn.addEventListener('click', function () {
        const appId = appIdInput.value;
        const appKey = appKeyInput.value;

        console.log('保存设置', { appId, appKey });

        // 保存到chrome.storage
        chrome.storage.sync.set({
            appid: appId,
            key: appKey
        }, function () {
            console.log('设置已保存');
            alert('设置已保存！');

            // 返回主界面
            settingsPanel.style.display = 'none';
            mainPanel.style.display = 'block';
        });
    });

    // 清除历史记录
    clearHistoryBtn.addEventListener('click', function () {
        if (confirm('确定要清除所有历史记录吗？')) {
            chrome.runtime.sendMessage({
                action: "clearHistory"
            }, (response) => {
                if (response && response.success) {
                    loadHistory();
                }
            });
        }
    });

    // 语言交换按钮
    swapBtn.addEventListener('click', function () {
        const sourceLang = document.getElementById('sourceLang');
        const targetLang = document.getElementById('targetLang');

        const temp = sourceLang.value;
        sourceLang.value = targetLang.value;
        targetLang.value = temp;

        console.log('交换语言方向:', sourceLang.value, '→', targetLang.value);

        // 保存语言设置
        chrome.storage.sync.set({
            from: sourceLang.value,
            to: targetLang.value
        }, function () {
            console.log('Language settings saved.');
        });
    });

    // 翻译按钮点击事件
    translateBtn.addEventListener('click', function () {
        const text = sourceText.value.trim();
        if (!text) {
            showError('请输入要翻译的文本');
            return;
        }

        console.log('开始翻译:', text);

        const from = document.getElementById('sourceLang').value;
        const to = document.getElementById('targetLang').value;

        // 显示加载状态
        setLoadingState(true);
        clearError();
        resultPlaceholder.textContent = '翻译中...';
        translatedText.textContent = '';

        // 发送翻译请求到后台
        chrome.runtime.sendMessage({
            action: "translate",
            text: text,
            from: from,
            to: to
        }, (response) => {
            setLoadingState(false);

            if (response && response.success) {
                const data = response.data;
                if (data.trans_result) {
                    resultPlaceholder.textContent = '';
                    translatedText.innerHTML = `
            <p><strong>原文:</strong> ${data.trans_result[0].src}</p>
            <p><strong>译文:</strong> ${data.trans_result[0].dst}</p>
          `;

                    // 重新加载历史记录
                    loadHistory();
                } else {
                    resultPlaceholder.textContent = `翻译错误: ${data.error_msg || '未知错误'}`;
                }
            } else {
                resultPlaceholder.textContent = `翻译失败: ${response.error || '未知错误'}`;
            }
        });
    });

    // 加载设置
    function loadSettings() {
        chrome.storage.sync.get(['appid', 'key', 'from', 'to'], function (data) {
            console.log('Loaded settings:', data);
            appIdInput.value = data.appid || '';
            appKeyInput.value = data.key || '';
            document.getElementById('sourceLang').value = data.from || 'auto';
            document.getElementById('targetLang').value = data.to || 'zh';
        });
    }

    // 加载历史记录
    function loadHistory() {
        chrome.runtime.sendMessage({
            action: "getHistory"
        }, (response) => {
            if (response && response.success) {
                const history = response.history || [];

                if (history.length === 0) {
                    historyList.innerHTML = '<div class="history-empty">暂无历史记录</div>';
                    return;
                }

                historyList.innerHTML = '';
                history.forEach(item => {
                    const historyItem = document.createElement('div');
                    historyItem.className = 'history-item';
                    historyItem.innerHTML = `
            <div><strong>${item.original}</strong></div>
            <div>→ ${item.translation}</div>
          `;

                    // 点击历史记录项可以重新翻译
                    historyItem.addEventListener('click', () => {
                        sourceText.value = item.original;
                        document.getElementById('sourceLang').value = item.from;
                        document.getElementById('targetLang').value = item.to;

                        // 触发翻译
                        translateBtn.click();
                    });

                    historyList.appendChild(historyItem);
                });
            }
        });
    }

    // 设置加载状态
    function setLoadingState(isLoading) {
        if (isLoading) {
            btnText.style.display = 'none';
            btnLoading.style.display = 'inline-block';
            translateBtn.disabled = true;
        } else {
            btnText.style.display = 'inline-block';
            btnLoading.style.display = 'none';
            translateBtn.disabled = false;
        }
    }

    // 显示错误信息
    function showError(message) {
        errorMessage.textContent = message;
    }

    // 清除错误信息
    function clearError() {
        errorMessage.textContent = '';
    }

    console.log('Popup initialized.');
});