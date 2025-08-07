document.addEventListener('DOMContentLoaded', function() {
    // 检查用户是否已登录，如果已登录则跳转到管理员页面
    if (localStorage.getItem('token')) {
        window.location.href = 'admin.html';
    }

    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');

    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        // 发送登录请求到服务器
        fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.message || '登录失败');
                });
            }
            return response.json();
        })
        .then(data => {
            // 登录成功，保存token并重定向到管理员页面
            localStorage.setItem('token', data.token);
            window.location.href = 'admin.html';
        })
        .catch(error => {
            // 显示错误消息
            errorMessage.textContent = error.message;
            // 3秒后清除错误消息
            setTimeout(() => {
                errorMessage.textContent = '';
            }, 3000);
        });
    });
});
