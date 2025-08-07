document.addEventListener('DOMContentLoaded', function() {
    const keyVerificationForm = document.getElementById('keyVerificationForm');
    const keyInput = document.getElementById('keyInput');
    const errorMessage = document.getElementById('errorMessage');
    const downloadSection = document.getElementById('downloadSection');
    const softwareTitle = document.getElementById('softwareTitle');
    const softwareExpiry = document.getElementById('softwareExpiry');
    const downloadLinksContainer = document.getElementById('downloadLinksContainer');

    // 定义API基础路径（适配Netlify Functions）
    const API_BASE = '/.netlify/functions/server';

    // 检查URL参数中是否有卡密
    const urlParams = new URLSearchParams(window.location.search);
    const keyFromUrl = urlParams.get('key');
    if (keyFromUrl) {
        keyInput.value = keyFromUrl;
        // 自动提交表单验证
        keyVerificationForm.dispatchEvent(new Event('submit'));
    }

    keyVerificationForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const keyCode = keyInput.value.trim();

        if (!keyCode) {
            showError('请输入卡密');
            return;
        }

        // 发送卡密验证请求（已添加正确路径前缀）
        fetch(`${API_BASE}/api/verify-key`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code: keyCode }) // 修复参数名，与后端保持一致
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.message || '卡密验证失败');
                }).catch(() => {
                    // 处理非JSON格式的错误响应
                    throw new Error('服务器响应格式错误');
                });
            }
            return response.json();
        })
        .then(data => {
            // 验证成功，显示下载链接
            showDownloadSection(data);
            clearError();
        })
        .catch(error => {
            // 验证失败，显示错误消息
            showError(error.message);
            // 隐藏下载区域
            downloadSection.style.display = 'none';
        });
    });

    // 显示错误消息
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        // 3秒后清除错误消息
        setTimeout(clearError, 3000);
    }

    // 清除错误消息
    function clearError() {
        errorMessage.textContent = '';
        errorMessage.style.display = 'none';
    }

    // 显示下载区域
    function showDownloadSection(data) {
        softwareTitle.textContent = data.software?.name || '未知软件';
        
        // 显示有效期信息
        if (data.validUntil) {
            const validUntil = new Date(data.validUntil);
            softwareExpiry.textContent = `卡密有效期至: ${formatDate(validUntil)}`;
        } else {
            softwareExpiry.textContent = '卡密永久有效';
        }

        // 显示下载链接
        downloadLinksContainer.innerHTML = '';
        
        if (data.software?.downloadUrls && data.software.downloadUrls.length > 0) {
            data.software.downloadUrls.forEach((url, index) => {
                const linkItem = document.createElement('div');
                linkItem.className = 'download-link-item';
                
                let linkName = `下载文件 ${index + 1}`;
                if (data.software.fileType === 'multiple') {
                    linkName = `分卷 ${index + 1}`;
                }

                linkItem.innerHTML = `
                    <div class="link-info">
                        <i class="fas fa-file link-icon"></i>
                        <div class="link-name">${linkName}</div>
                    </div>
                    <a href="${url}" class="btn-download" target="_blank" rel="noopener noreferrer">
                        <i class="fas fa-download"></i> 下载
                    </a>
                `;

                downloadLinksContainer.appendChild(linkItem);
            });
        } else {
            downloadLinksContainer.innerHTML = '<p>暂无可用下载链接</p>';
        }

        // 显示下载区域并滚动到该区域
        downloadSection.style.display = 'block';
        downloadSection.scrollIntoView({ behavior: 'smooth' });
    }

    // 格式化日期
    function formatDate(date) {
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }
});
