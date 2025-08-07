document.addEventListener('DOMContentLoaded', function() {
    // 检查用户是否已登录，如果未登录则跳转到登录页面
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // 页面元素
    const sectionHeaders = document.querySelectorAll('.section-header');
    const softwareForm = document.getElementById('softwareForm');
    const keyForm = document.getElementById('keyForm');
    const addUrlBtn = document.getElementById('addUrlBtn');
    const downloadUrlsContainer = document.getElementById('downloadUrlsContainer');
    const selectSoftware = document.getElementById('selectSoftware');
    const filterSoftware = document.getElementById('filterSoftware');
    const generatedKeysList = document.getElementById('generatedKeysList');
    const copyKeysBtn = document.getElementById('copyKeysBtn');
    const softwareList = document.getElementById('softwareList');
    const keyList = document.getElementById('keyList');
    const softwarePagination = document.getElementById('softwarePagination');
    const keyPagination = document.getElementById('keyPagination');
    const softwareSearch = document.getElementById('softwareSearch');
    const keySearch = document.getElementById('keySearch');
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const changePasswordModal = document.getElementById('changePasswordModal');
    const closeModalBtns = document.querySelectorAll('.close-modal, .close-modal-btn');
    const changePasswordForm = document.getElementById('changePasswordForm');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    // 分页设置
    const itemsPerPage = 5;
    let currentSoftwarePage = 1;
    let currentKeyPage = 1;
    let allSoftware = [];
    let allKeys = [];
    let filteredSoftware = [];
    let filteredKeys = [];

    // 初始化页面
    init();

    // 初始化函数
    function init() {
        // 加载软件列表
        loadSoftware();
        // 加载卡密列表
        loadKeys();
        // 设置事件监听器
        setupEventListeners();
    }

    // 设置事件监听器
    function setupEventListeners() {
        // 部分折叠/展开功能
        sectionHeaders.forEach(header => {
            header.addEventListener('click', function() {
                const content = this.nextElementSibling;
                const icon = this.querySelector('.toggle-icon');
                
                if (content.style.display === 'none' || !content.style.display) {
                    content.style.display = 'block';
                    icon.classList.add('rotate');
                } else {
                    content.style.display = 'none';
                    icon.classList.remove('rotate');
                }
            });
        });

        // 添加更多下载地址
        addUrlBtn.addEventListener('click', addDownloadUrlField);

        // 提交软件表单
        softwareForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveSoftware();
        });

        // 提交卡密生成表单
        keyForm.addEventListener('submit', function(e) {
            e.preventDefault();
            generateKeys();
        });

        // 复制所有卡密
        copyKeysBtn.addEventListener('click', copyAllKeys);

        // 软件搜索
        softwareSearch.addEventListener('input', function() {
            filterSoftwareList();
        });

        // 卡密搜索
        keySearch.addEventListener('input', function() {
            filterKeyList();
        });

        // 按软件筛选卡密
        filterSoftware.addEventListener('change', function() {
            filterKeyList();
        });

        // 修改密码按钮
        changePasswordBtn.addEventListener('click', function() {
            changePasswordModal.style.display = 'flex';
        });

        // 关闭模态框
        closeModalBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                changePasswordModal.style.display = 'none';
            });
        });

        // 点击模态框外部关闭
        window.addEventListener('click', function(e) {
            if (e.target === changePasswordModal) {
                changePasswordModal.style.display = 'none';
            }
        });

        // 提交密码修改表单
        changePasswordForm.addEventListener('submit', function(e) {
            e.preventDefault();
            changePassword();
        });

        // 退出登录
        logoutBtn.addEventListener('click', logout);
    }

    // 添加下载地址输入框
    function addDownloadUrlField() {
        const urlGroups = document.querySelectorAll('.download-url-group');
        const newIndex = urlGroups.length + 1;

        const urlGroup = document.createElement('div');
        urlGroup.className = 'form-group download-url-group';
        urlGroup.innerHTML = `
            <label for="downloadUrl${newIndex}">下载地址 ${newIndex}</label>
            <div class="url-input-group">
                <input type="url" id="downloadUrl${newIndex}" required>
                <button type="button" class="remove-url-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        downloadUrlsContainer.appendChild(urlGroup);

        // 添加删除按钮事件
        const removeBtn = urlGroup.querySelector('.remove-url-btn');
        removeBtn.addEventListener('click', function() {
            urlGroup.remove();
            // 重新编号
            renumberUrlFields();
        });
    }

    // 重新编号下载地址输入框
    function renumberUrlFields() {
        const urlGroups = document.querySelectorAll('.download-url-group');
        urlGroups.forEach((group, index) => {
            const newIndex = index + 1;
            const label = group.querySelector('label');
            const input = group.querySelector('input');
            
            label.textContent = `下载地址 ${newIndex}`;
            label.setAttribute('for', `downloadUrl${newIndex}`);
            input.setAttribute('id', `downloadUrl${newIndex}`);
        });
    }

    // 保存软件
    function saveSoftware() {
        const softwareName = document.getElementById('softwareName').value;
        const fileType = document.getElementById('fileType').value;
        const urlInputs = document.querySelectorAll('.download-url-group input');
        
        const downloadUrls = Array.from(urlInputs).map(input => input.value);
        
        const softwareData = {
            name: softwareName,
            fileType: fileType,
            downloadUrls: downloadUrls
        };

        fetch('/api/software', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(softwareData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.message || '保存软件失败');
                });
            }
            return response.json();
        })
        .then(data => {
            showToast('软件保存成功', 'success');
            softwareForm.reset();
            // 重置下载地址输入框，只保留一个
            while (downloadUrlsContainer.children.length > 1) {
                downloadUrlsContainer.removeChild(downloadUrlsContainer.lastChild);
            }
            downloadUrlsContainer.querySelector('input').value = '';
            // 重新加载软件列表
            loadSoftware();
        })
        .catch(error => {
            showToast(error.message, 'error');
        });
    }

    // 加载软件列表
    function loadSoftware() {
        fetch('/api/software', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 401) {
                    // 未授权，跳转到登录页面
                    logout();
                    return;
                }
                return response.json().then(data => {
                    throw new Error(data.message || '加载软件失败');
                });
            }
            return response.json();
        })
        .then(data => {
            allSoftware = data;
            filteredSoftware = [...allSoftware];
            // 更新软件下拉列表
            updateSoftwareDropdowns();
            // 显示软件列表
            displaySoftwareList();
        })
        .catch(error => {
            showToast(error.message, 'error');
        });
    }

    // 更新软件下拉列表
    function updateSoftwareDropdowns() {
        // 清空现有选项（保留第一个提示选项）
        while (selectSoftware.options.length > 1) {
            selectSoftware.remove(1);
        }
        
        while (filterSoftware.options.length > 1) {
            filterSoftware.remove(1);
        }

        // 添加新选项
        allSoftware.forEach(software => {
            const option1 = document.createElement('option');
            option1.value = software.id;
            option1.textContent = software.name;
            selectSoftware.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = software.id;
            option2.textContent = software.name;
            filterSoftware.appendChild(option2);
        });
    }

    // 筛选软件列表
    function filterSoftwareList() {
        const searchTerm = softwareSearch.value.toLowerCase();
        filteredSoftware = allSoftware.filter(software => 
            software.name.toLowerCase().includes(searchTerm)
        );
        currentSoftwarePage = 1;
        displaySoftwareList();
    }

    // 显示软件列表
    function displaySoftwareList() {
        const totalPages = Math.ceil(filteredSoftware.length / itemsPerPage);
        const startIndex = (currentSoftwarePage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const currentItems = filteredSoftware.slice(startIndex, endIndex);

        softwareList.innerHTML = '';

        if (currentItems.length === 0) {
            softwareList.innerHTML = '<p class="no-items">没有找到软件</p>';
            softwarePagination.innerHTML = '';
            return;
        }

        currentItems.forEach(software => {
            const softwareItem = document.createElement('div');
            softwareItem.className = 'software-item';
            
            let urlsList = '';
            software.downloadUrls.forEach((url, index) => {
                urlsList += `<li>地址 ${index + 1}: ${url}</li>`;
            });

            softwareItem.innerHTML = `
                <div class="software-header">
                    <div class="software-name">${software.name}</div>
                    <div class="software-actions">
                        <button class="btn btn-secondary btn-edit-software" data-id="${software.id}">
                            <i class="fas fa-edit"></i> 编辑
                        </button>
                        <button class="btn btn-danger btn-delete-software" data-id="${software.id}">
                            <i class="fas fa-trash"></i> 删除
                        </button>
                    </div>
                </div>
                <div class="software-body">
                    <div class="software-info">
                        <strong>文件类型:</strong> ${software.fileType === 'single' ? '单个文件' : '分卷压缩'}
                    </div>
                    <div class="software-info">
                        <strong>下载地址:</strong>
                        <ul class="url-list">
                            ${urlsList}
                        </ul>
                    </div>
                </div>
            `;

            softwareList.appendChild(softwareItem);

            // 添加删除软件事件
            softwareItem.querySelector('.btn-delete-software').addEventListener('click', function() {
                const softwareId = this.getAttribute('data-id');
                deleteSoftware(softwareId);
            });

            // 添加编辑软件事件
            softwareItem.querySelector('.btn-edit-software').addEventListener('click', function() {
                const softwareId = this.getAttribute('data-id');
                editSoftware(softwareId);
            });
        });

        // 生成分页控件
        generatePagination(softwarePagination, totalPages, currentSoftwarePage, function(page) {
            currentSoftwarePage = page;
            displaySoftwareList();
        });
    }

    // 编辑软件
    function editSoftware(softwareId) {
        const software = allSoftware.find(s => s.id === softwareId);
        if (!software) return;

        // 填充表单
        document.getElementById('softwareName').value = software.name;
        document.getElementById('fileType').value = software.fileType;

        // 清空现有下载地址输入框
        while (downloadUrlsContainer.firstChild) {
            downloadUrlsContainer.removeChild(downloadUrlsContainer.firstChild);
        }

        // 添加下载地址输入框
        software.downloadUrls.forEach((url, index) => {
            const urlGroup = document.createElement('div');
            urlGroup.className = 'form-group download-url-group';
            
            const isFirst = index === 0;
            urlGroup.innerHTML = `
                <label for="downloadUrl${index + 1}">下载地址 ${isFirst ? '*' : index + 1}</label>
                <div class="url-input-group">
                    <input type="url" id="downloadUrl${index + 1}" value="${url}" ${isFirst ? 'required' : ''}>
                    ${!isFirst ? `<button type="button" class="remove-url-btn">
                        <i class="fas fa-times"></i>
                    </button>` : ''}
                </div>
            `;

            downloadUrlsContainer.appendChild(urlGroup);

            // 非第一个添加删除按钮事件
            if (!isFirst) {
                const removeBtn = urlGroup.querySelector('.remove-url-btn');
                removeBtn.addEventListener('click', function() {
                    urlGroup.remove();
                    renumberUrlFields();
                });
            }
        });

        // 修改表单提交事件处理
        const originalSubmitHandler = softwareForm.onsubmit;
        softwareForm.onsubmit = function(e) {
            e.preventDefault();
            
            const softwareName = document.getElementById('softwareName').value;
            const fileType = document.getElementById('fileType').value;
            const urlInputs = document.querySelectorAll('.download-url-group input');
            
            const downloadUrls = Array.from(urlInputs).map(input => input.value);
            
            const updatedData = {
                name: softwareName,
                fileType: fileType,
                downloadUrls: downloadUrls
            };

            fetch(`/api/software/${softwareId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updatedData)
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.message || '更新软件失败');
                    });
                }
                return response.json();
            })
            .then(data => {
                showToast('软件更新成功', 'success');
                // 恢复原始提交处理函数
                softwareForm.onsubmit = originalSubmitHandler;
                // 重置表单
                softwareForm.reset();
                while (downloadUrlsContainer.children.length > 1) {
                    downloadUrlsContainer.removeChild(downloadUrlsContainer.lastChild);
                }
                downloadUrlsContainer.querySelector('input').value = '';
                // 重新加载软件列表
                loadSoftware();
            })
            .catch(error => {
                showToast(error.message, 'error');
                // 恢复原始提交处理函数
                softwareForm.onsubmit = originalSubmitHandler;
            });
        };

        // 滚动到软件表单
        document.getElementById('softwareSectionHeader').scrollIntoView({ behavior: 'smooth' });
        // 确保软件部分是展开的
        const softwareContent = document.getElementById('softwareSectionContent');
        const softwareIcon = document.getElementById('softwareSectionHeader').querySelector('.toggle-icon');
        softwareContent.style.display = 'block';
        softwareIcon.classList.add('rotate');
    }

    // 删除软件
    function deleteSoftware(softwareId) {
        if (confirm('确定要删除这个软件吗？相关的卡密也会被删除。')) {
            fetch(`/api/software/${softwareId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.message || '删除软件失败');
                    });
                }
                return response.json();
            })
            .then(data => {
                showToast('软件删除成功', 'success');
                // 重新加载软件和卡密列表
                loadSoftware();
                loadKeys();
            })
            .catch(error => {
                showToast(error.message, 'error');
            });
        }
    }

    // 生成卡密
    function generateKeys() {
        const softwareId = selectSoftware.value;
        const keyCount = parseInt(document.getElementById('keyCount').value);
        const validityPeriod = parseInt(document.getElementById('validityPeriod').value);

        if (!softwareId) {
            showToast('请选择软件', 'error');
            return;
        }

        fetch('/api/keys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                softwareId,
                count: keyCount,
                validityDays: validityPeriod
            })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.message || '生成卡密失败');
                });
            }
            return response.json();
        })
        .then(data => {
            showToast(`成功生成 ${data.keys.length} 个卡密`, 'success');
            // 显示生成的卡密
            displayGeneratedKeys(data.keys);
            // 重新加载卡密列表
            loadKeys();
        })
        .catch(error => {
            showToast(error.message, 'error');
        });
    }

    // 显示生成的卡密
    function displayGeneratedKeys(keys) {
        generatedKeysList.innerHTML = '';

        keys.forEach(key => {
            const keyItem = document.createElement('div');
            keyItem.className = 'key-item';
            keyItem.innerHTML = `
                ${key.code}
                <button class="copy-key-btn" data-key="${key.code}">
                    <i class="fas fa-copy"></i> 复制
                </button>
            `;
            generatedKeysList.appendChild(keyItem);

            // 添加复制单个卡密事件
            keyItem.querySelector('.copy-key-btn').addEventListener('click', function() {
                const keyCode = this.getAttribute('data-key');
                copyToClipboard(keyCode);
                showToast('卡密已复制', 'success');
            });
        });

        // 显示复制所有卡密按钮
        copyKeysBtn.style.display = 'block';
        // 滚动到生成的卡密区域
        generatedKeysList.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // 复制所有卡密
    function copyAllKeys() {
        const keyElements = document.querySelectorAll('.key-item');
        const keys = Array.from(keyElements).map(el => el.firstChild.textContent.trim()).join('\n');
        
        copyToClipboard(keys);
        showToast('所有卡密已复制', 'success');
    }

    // 复制到剪贴板
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).catch(err => {
            console.error('无法复制文本: ', err);
        });
    }

    // 加载卡密列表
    function loadKeys() {
        fetch('/api/keys', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 401) {
                    // 未授权，跳转到登录页面
                    logout();
                    return;
                }
                return response.json().then(data => {
                    throw new Error(data.message || '加载卡密失败');
                });
            }
            return response.json();
        })
        .then(data => {
            allKeys = data;
            filteredKeys = [...allKeys];
            // 显示卡密列表
            displayKeyList();
        })
        .catch(error => {
            showToast(error.message, 'error');
        });
    }

    // 筛选卡密列表
    function filterKeyList() {
        const searchTerm = keySearch.value.toLowerCase();
        const softwareFilter = filterSoftware.value;

        filteredKeys = allKeys.filter(key => {
            const matchesSearch = key.code.toLowerCase().includes(searchTerm) || 
                                 (key.software && key.software.name.toLowerCase().includes(searchTerm));
            const matchesSoftware = !softwareFilter || key.softwareId === softwareFilter;
            return matchesSearch && matchesSoftware;
        });

        currentKeyPage = 1;
        displayKeyList();
    }

    // 显示卡密列表
    function displayKeyList() {
        const totalPages = Math.ceil(filteredKeys.length / itemsPerPage);
        const startIndex = (currentKeyPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const currentItems = filteredKeys.slice(startIndex, endIndex);

        keyList.innerHTML = '';

        if (currentItems.length === 0) {
            keyList.innerHTML = '<p class="no-items">没有找到卡密</p>';
            keyPagination.innerHTML = '';
            return;
        }

        currentItems.forEach(key => {
            const keyItem = document.createElement('div');
            keyItem.className = 'key-item-manage';
            
            // 格式化有效期
            let expiryText = '';
            if (key.validUntil) {
                const validUntil = new Date(key.validUntil);
                const now = new Date();
                const isExpired = validUntil < now;
                
                expiryText = `
                    <div class="key-detail-item">
                        <strong>有效期至:</strong>
                        <div class="key-code ${isExpired ? 'text-expired' : ''}">${formatDate(validUntil)}</div>
                        ${isExpired ? '<span class="expired-badge">已过期</span>' : ''}
                    </div>
                `;
            } else {
                expiryText = `
                    <div class="key-detail-item">
                        <strong>有效期:</strong>
                        <div class="key-code">永久有效</div>
                    </div>
                `;
            }

            keyItem.innerHTML = `
                <div class="key-header">
                    <div class="software-name">${key.software ? key.software.name : '未知软件'}</div>
                    <div class="key-actions">
                        <button class="btn btn-secondary btn-copy-key" data-key="${key.code}">
                            <i class="fas fa-copy"></i> 复制
                        </button>
                        <button class="btn btn-danger btn-delete-key" data-id="${key.id}">
                            <i class="fas fa-trash"></i> 删除
                        </button>
                    </div>
                </div>
                <div class="key-body">
                    <div class="key-details">
                        <div class="key-detail-item">
                            <strong>卡密:</strong>
                            <div class="key-code">${key.code}</div>
                        </div>
                        ${expiryText}
                        <div class="key-detail-item">
                            <strong>生成时间:</strong>
                            <div class="key-code">${formatDate(new Date(key.createdAt))}</div>
                        </div>
                        <div class="key-detail-item">
                            <strong>状态:</strong>
                            <div class="key-code">${key.used ? '已使用' : '未使用'}</div>
                        </div>
                    </div>
                </div>
            `;

            keyList.appendChild(keyItem);

            // 添加删除卡密事件
            keyItem.querySelector('.btn-delete-key').addEventListener('click', function() {
                const keyId = this.getAttribute('data-id');
                deleteKey(keyId);
            });

            // 添加复制卡密事件
            keyItem.querySelector('.btn-copy-key').addEventListener('click', function() {
                const keyCode = this.getAttribute('data-key');
                copyToClipboard(keyCode);
                showToast('卡密已复制', 'success');
            });
        });

        // 生成分页控件
        generatePagination(keyPagination, totalPages, currentKeyPage, function(page) {
            currentKeyPage = page;
            displayKeyList();
        });
    }

    // 删除卡密
    function deleteKey(keyId) {
        if (confirm('确定要删除这个卡密吗？')) {
            fetch(`/api/keys/${keyId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.message || '删除卡密失败');
                    });
                }
                return response.json();
            })
            .then(data => {
                showToast('卡密删除成功', 'success');
                // 重新加载卡密列表
                loadKeys();
            })
            .catch(error => {
                showToast(error.message, 'error');
            });
        }
    }

    // 生成分页控件
    function generatePagination(container, totalPages, currentPage, onPageChange) {
        container.innerHTML = '';

        if (totalPages <= 1) {
            return;
        }

        // 上一页按钮
        const prevBtn = document.createElement('button');
        prevBtn.className = 'page-btn';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                onPageChange(currentPage - 1);
            }
        });
        container.appendChild(prevBtn);

        // 页码按钮
        for (let i = 1; i <= totalPages; i++) {
            // 只显示当前页附近的页码
            if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
                const pageBtn = document.createElement('button');
                pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
                pageBtn.textContent = i;
                pageBtn.addEventListener('click', () => onPageChange(i));
                container.appendChild(pageBtn);
            } else if (i === 2 && currentPage > 3) {
                // 添加省略号
                const ellipsis = document.createElement('span');
                ellipsis.className = 'pagination-ellipsis';
                ellipsis.textContent = '...';
                container.appendChild(ellipsis);
            } else if (i === totalPages - 1 && currentPage < totalPages - 2) {
                // 添加省略号
                const ellipsis = document.createElement('span');
                ellipsis.className = 'pagination-ellipsis';
                ellipsis.textContent = '...';
                container.appendChild(ellipsis);
            }
        }

        // 下一页按钮
        const nextBtn = document.createElement('button');
        nextBtn.className = 'page-btn';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                onPageChange(currentPage + 1);
            }
        });
        container.appendChild(nextBtn);
    }

    // 修改密码
    function changePassword() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // 验证密码
        if (newPassword !== confirmPassword) {
            showToast('两次输入的新密码不一致', 'error');
            return;
        }

        if (newPassword.length < 6) {
            showToast('新密码长度不能少于6个字符', 'error');
            return;
        }

        fetch('/api/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                currentPassword,
                newPassword
            })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.message || '修改密码失败');
                });
            }
            return response.json();
        })
        .then(data => {
            showToast('密码修改成功，请重新登录', 'success');
            // 关闭模态框并重置表单
            changePasswordModal.style.display = 'none';
            changePasswordForm.reset();
            // 退出登录
            setTimeout(logout, 1500);
        })
        .catch(error => {
            showToast(error.message, 'error');
        });
    }

    // 退出登录
    function logout() {
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    }

    // 显示提示消息
    function showToast(message, type = 'info') {
        toastMessage.textContent = message;
        toast.className = 'toast';
        toast.classList.add(type);
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // 格式化日期
    function formatDate(date) {
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
});
