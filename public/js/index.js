document.addEventListener('DOMContentLoaded', function() {
    const keyVerificationForm = document.getElementById('keyVerificationForm');
    const keyInput = document.getElementById('keyInput');
    const errorMessage = document.getElementById('errorMessage');
    const downloadSection = document.getElementById('downloadSection');
    const softwareTitle = document.getElementById('softwareTitle');
    const softwareExpiry = document.getElementById('softwareExpiry');
    const downloadLinksContainer = document.getElementById('downloadLinksContainer');

    // 定义API基础路径（与后端匹配）
    const API_BASE = '/.netlify/functions/server';

    // URL参数自动填充卡密
    const urlParams = new URLSearchParams(window.location.search);
    const keyFromUrl = urlParams.get('key');
    if (keyFromUrl) {
        keyInput.value = keyFromUrl;
        keyVerificationForm.dispatchEvent(new Event('submit'));
    }

    // 验证卡密表单提交
    keyVerificationForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const keyCode = keyInput.value.trim();

        if (!keyCode) {
            showError('请输入卡密');
            return;
        }

        try {
            // 发送验证请求（路径确保正确）
            const response = await fetch(`${API_BASE}/api/verify-key`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: keyCode })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || '卡密验证失败');
            }

            if (data.valid) {
                showDownloadSection(data);
                clearError();
            } else {
                showError(data.message || '卡密无效');
                downloadSection.style.display = 'none';
            }
        } catch (error) {
            showError(error.message || '验证失败，请重试');
            downloadSection.style.display = 'none';
        }
    });

    // 错误提示
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        setTimeout(clearError, 3000);
    }

    function clearError() {
        errorMessage.textContent = '';
        errorMessage.style.display = 'none';
    }

    // 显示下载区域
    function showDownloadSection(data) {
        // 显示软件名称
        softwareTitle.textContent = data.software?.name || '未知软件';

        // 显示有效期
        if (data.validUntil) {
            const validUntil = new Date(data.validUntil);
            softwareExpiry.textContent = `卡密有效期至: ${formatDate(validUntil)}`;
        } else {
            softwareExpiry.textContent = '卡密永久有效';
        }

        // 显示下载链接
        downloadLinksContainer.innerHTML = '';
        if (data.software?.downloadUrls?.length) {
            data.software.downloadUrls.forEach((url, index) => {
                const linkItem = document.createElement('div');
                linkItem.className = 'download-link-item';
                const linkName = data.software.fileType === 'multiple' ? `分卷 ${index + 1}` : `下载文件 ${index + 1}`;
                
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

        // 显示并滚动到下载区域
        downloadSection.style.display = 'block';
        downloadSection.scrollIntoView({ behavior: 'smooth' });
    }

    // 日期格式化
    function formatDate(date) {
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }
});
