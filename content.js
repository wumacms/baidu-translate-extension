console.log('Content script loaded.');

// 创建翻译结果显示容器
const createTranslationBox = () => {
    const box = document.createElement('div');
    box.id = 'translation-box';
    box.style.cssText = `
        position: fixed;
        top: 50px;
        right: 20px;
        background: white;
        border: 1px solid #ddd;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 400px;
        max-height: 500px;
        overflow: hidden;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #333;
        display: none;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: #f1f1f1;
        border: none;
        border-radius: 50%;
        width: 28px;
        height: 28px;
        cursor: pointer;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition: background 0.2s;
    `;
    closeBtn.onmouseover = () => {
        closeBtn.style.background = '#e5e5e5';
    };
    closeBtn.onmouseout = () => {
        closeBtn.style.background = '#f1f1f1';
    };
    closeBtn.onclick = () => {
        box.style.display = 'none';
    };

    const header = document.createElement('div');
    header.textContent = '翻译结果';
    header.style.cssText = `
        font-weight: bold;
        margin-bottom: 15px;
        padding-bottom: 10px;
        border-bottom: 1px solid #eee;
        color: #4a76a8;
        font-size: 16px;
    `;

    const content = document.createElement('div');
    content.id = 'translation-content';
    content.style.cssText = `
        max-height: 300px;
        overflow-y: auto;
        padding-right: 5px;
    `;

    // 添加滚动条样式
    const style = document.createElement('style');
    style.textContent = `
        #translation-content::-webkit-scrollbar {
            width: 6px;
        }
        #translation-content::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 3px;
        }
        #translation-content::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 3px;
        }
        #translation-content::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8;
        }
    `;
    document.head.appendChild(style);

    box.appendChild(closeBtn);
    box.appendChild(header);
    box.appendChild(content);
    document.body.appendChild(box);

    return box;
};

let translationBox = null;

// 更新右键菜单文本
function updateContextMenuText() {
    chrome.storage.sync.get(['from', 'to'], (data) => {
        const from = data.from || 'auto';
        const to = data.to || 'zh';

        const languageNames = {
            'auto': '自动',
            'zh': '中文',
            'en': '英文',
            'jp': '日文',
            'kor': '韩文',
            'fra': '法文',
            'de': '德文'
        };

        const fromText = languageNames[from] || from;
        const toText = languageNames[to] || to;

        chrome.contextMenus.update('translate-text', {
            title: `翻译到${toText}: '%s'`
        }, () => {
            if (chrome.runtime.lastError) {
                console.log('Context menu update error:', chrome.runtime.lastError);
            }
        });
    });
}

// 初始化右键菜单
function initContextMenu() {
    const translateText = document.getElementById('translate-text')
    if (!translateText) return;
    // 移除现有的右键菜单（如果存在）
    chrome.contextMenus.remove('translate-text', () => {
        // 忽略错误，可能菜单不存在
        chrome.contextMenus.create({
            id: "translate-text",
            title: "翻译: '%s'", // 初始文本，会被updateContextMenuText更新
            contexts: ["selection"]
        }, () => {
            if (chrome.runtime.lastError) {
                console.log('Context menu creation error:', chrome.runtime.lastError);
            } else {
                updateContextMenuText();
            }
        });
    });
}

// 确保翻译弹窗在可视区域内
function positionTranslationBox() {
    if (!translationBox) return;

    const box = document.getElementById('translation-box');
    const rect = box.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // 如果弹窗底部超出视窗底部，向上移动
    if (rect.bottom > viewportHeight) {
        box.style.top = `${viewportHeight - rect.height - 20}px`;
    }

    // 如果弹窗右侧超出视窗右侧，向左移动
    if (rect.right > viewportWidth) {
        box.style.right = `${viewportWidth - rect.width - 20}px`;
    }
}

// 监听来自后台脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "translate") {
        console.log('Content script received translation request:', request.text);

        // 显示加载状态
        if (!translationBox) {
            translationBox = createTranslationBox();
        }

        const content = document.getElementById('translation-content');
        content.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;height:100px;">
                <div style="display:flex;align-items:center;">
                    <div style="width:20px;height:20px;border:3px solid #f3f3f3;border-top:3px solid #4a76a8;border-radius:50%;animation:spin 1s linear infinite;margin-right:10px;"></div>
                    <span>翻译中...</span>
                </div>
            </div>
        `;
        translationBox.style.display = 'block';

        // 确保弹窗在可视区域内
        positionTranslationBox();

        // 发送翻译请求到后台
        chrome.runtime.sendMessage({
            action: "translate",
            text: request.text
        }, (response) => {
            console.log('Translation response received:', response);

            if (response && response.success) {
                const data = response.data;
                if (data.trans_result) {
                    let html = `
                        <div style="margin-bottom:15px;">
                            <div style="font-size:12px;color:#666;margin-bottom:5px;">原文</div>
                            <div style="background:#f8f9fa;padding:10px;border-radius:4px;border-left:3px solid #4a76a8;">${data.trans_result[0].src}</div>
                        </div>
                        <div>
                            <div style="font-size:12px;color:#666;margin-bottom:5px;">译文</div>
                            <div style="background:#f0f7ff;padding:10px;border-radius:4px;border-left:3px solid #2196F3;">${data.trans_result[0].dst}</div>
                        </div>
                    `;

                    // 如果有多个翻译结果
                    if (data.trans_result.length > 1) {
                        html += `<div style="margin-top:15px;font-size:12px;color:#666;">共 ${data.trans_result.length} 条翻译结果</div>`;
                    }

                    content.innerHTML = html;
                } else {
                    content.innerHTML = `
                        <div style="color:#e74c3c;padding:10px;background:#ffeeee;border-radius:4px;">
                            <strong>翻译错误:</strong> ${data.error_msg || '未知错误'}
                        </div>
                    `;
                }
            } else {
                content.innerHTML = `
                    <div style="color:#e74c3c;padding:10px;background:#ffeeee;border-radius:4px;">
                        <strong>翻译失败:</strong> ${response.error || '未知错误'}
                    </div>
                `;
            }
        });
    }
});

// 添加CSS动画
const animationStyle = document.createElement('style');
animationStyle.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    #translation-box {
        animation: fadeIn 0.3s ease-in-out;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;
document.head.appendChild(animationStyle);

// 监听窗口大小变化，重新定位弹窗
window.addEventListener('resize', () => {
    positionTranslationBox();
});

// 初始化
initContextMenu();

// 监听设置变化，更新右键菜单文本
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && (changes.from || changes.to)) {
        updateContextMenuText();
    }
});

console.log('Content script initialized.');