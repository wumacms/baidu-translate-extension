// 导入MD5函数
importScripts('md5.js');

console.log('Background script loaded.');

// 设置默认配置
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed.');

    chrome.storage.sync.set({
        appid: '',
        key: '',
        from: 'auto',
        to: 'zh',
        translationHistory: []
    }, () => {
        console.log('Default settings saved.');
    });

    // 创建右键菜单
    chrome.contextMenus.create({
        id: "translate-text",
        title: chrome.i18n.getMessage("contextMenuTitle") || "翻译: '%s'",
        contexts: ["selection"]
    });
});

// 监听右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "translate-text" && info.selectionText) {
        console.log('Text selected for translation:', info.selectionText);

        // 发送消息给内容脚本
        chrome.tabs.sendMessage(tab.id, {
            action: "translate",
            text: info.selectionText
        }).catch(err => {
            console.log('Error sending message to content script:', err);
        });
    }
});

// 处理来自内容脚本的翻译请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "translate") {
        console.log('Translation request received:', request.text);

        // 从存储中获取配置
        chrome.storage.sync.get(['appid', 'key', 'from', 'to', 'translationHistory'], (data) => {
            const appid = data.appid || '';
            const key = data.key || '';
            const from = request.from || data.from || 'auto';
            const to = request.to || data.to || 'zh';

            if (!appid || !key) {
                console.error('AppID or Key not configured');
                sendResponse({ success: false, error: '请先配置百度翻译API的AppID和密钥' });
                return;
            }

            const salt = (new Date).getTime();
            const query = request.text;
            const str1 = appid + query + salt + key;
            const sign = MD5(str1);

            console.log('Making API request with params:', { appid, query, salt, from, to, sign });

            // 使用百度翻译API
            const url = `https://api.fanyi.baidu.com/api/trans/vip/translate?q=${encodeURIComponent(query)}&appid=${appid}&salt=${salt}&from=${from}&to=${to}&sign=${sign}`;

            fetch(url)
                .then(response => response.json())
                .then(data => {
                    console.log('Translation result:', data);

                    if (data.trans_result) {
                        // 保存到历史记录
                        const history = data.translationHistory || [];
                        history.unshift({
                            original: query,
                            translation: data.trans_result[0].dst,
                            from: from,
                            to: to,
                            timestamp: new Date().getTime()
                        });

                        // 限制历史记录数量
                        if (history.length > 50) {
                            history.pop();
                        }

                        chrome.storage.sync.set({ translationHistory: history });
                    }

                    sendResponse({ success: true, data: data });
                })
                .catch(error => {
                    console.error('Translation error:', error);
                    sendResponse({ success: false, error: error.message });
                });
        });

        return true; // 保持消息通道开放，用于异步响应
    }

    // 获取历史记录
    if (request.action === "getHistory") {
        chrome.storage.sync.get(['translationHistory'], (data) => {
            sendResponse({ success: true, history: data.translationHistory || [] });
        });
        return true;
    }

    // 清除历史记录
    if (request.action === "clearHistory") {
        chrome.storage.sync.set({ translationHistory: [] }, () => {
            sendResponse({ success: true });
        });
        return true;
    }
});