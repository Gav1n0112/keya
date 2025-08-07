const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 初始化Express应用
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// 密钥（实际应用中应使用环境变量）
const JWT_SECRET = 'your-secret-key-here'; // 生产环境中应更换为强密钥
const ADMIN_USERNAME = 'admin'; // 默认管理员用户名
const ADMIN_PASSWORD = 'password'; // 默认管理员密码，首次登录后应修改

// 数据存储文件路径
const DATA_DIR = path.join(process.cwd(), 'tmp', 'data');
const SOFTWARE_FILE = path.join(DATA_DIR, 'software.json');
const KEYS_FILE = path.join(DATA_DIR, 'keys.json');
const USER_FILE = path.join(DATA_DIR, 'user.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 初始化数据文件
function initDataFiles() {
    // 初始化用户数据
    if (!fs.existsSync(USER_FILE)) {
        const initialUser = {
            username: ADMIN_USERNAME,
            password: hashPassword(ADMIN_PASSWORD),
            updatedAt: new Date().toISOString()
        };
        fs.writeFileSync(USER_FILE, JSON.stringify(initialUser, null, 2));
    }

    // 初始化软件数据
    if (!fs.existsSync(SOFTWARE_FILE)) {
        fs.writeFileSync(SOFTWARE_FILE, JSON.stringify([], null, 2));
    }

    // 初始化卡密数据
    if (!fs.existsSync(KEYS_FILE)) {
        fs.writeFileSync(KEYS_FILE, JSON.stringify([], null, 2));
    }
}

// 密码哈希函数
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}

// 验证密码
function verifyPassword(password, hashedPassword) {
    const [salt, hash] = hashedPassword.split(':');
    const newHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return newHash === hash;
}

// 生成JWT令牌
function generateToken(userId) {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
}

// 验证JWT令牌的中间件
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: '未提供令牌' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: '令牌无效或已过期' });
        }
        req.user = user;
        next();
    });
}

// 读取数据
function readData(filePath) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`读取数据文件失败 ${filePath}:`, error);
        return [];
    }
}

// 写入数据
function writeData(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`写入数据文件失败 ${filePath}:`, error);
        return false;
    }
}

// 生成随机卡密
function generateKeyCode(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < length; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
        // 每4个字符添加一个连字符
        if ((i + 1) % 4 === 0 && i !== length - 1) {
            key += '-';
        }
    }
    return key;
}

// 生成唯一ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// 路由

// 登录
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ message: '请提供用户名和密码' });
    }

    const user = readData(USER_FILE);
    
    if (user.username !== username || !verifyPassword(password, user.password)) {
        return res.status(401).json({ message: '用户名或密码错误' });
    }

    // 生成令牌
    const token = generateToken(user.username);
    res.json({ token });
});

// 修改密码
app.post('/api/change-password', authenticateToken, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: '请提供当前密码和新密码' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: '新密码长度不能少于6个字符' });
    }

    let user = readData(USER_FILE);
    
    if (!verifyPassword(currentPassword, user.password)) {
        return res.status(401).json({ message: '当前密码错误' });
    }

    // 更新密码
    user.password = hashPassword(newPassword);
    user.updatedAt = new Date().toISOString();
    
    if (writeData(USER_FILE, user)) {
        res.json({ message: '密码修改成功' });
    } else {
        res.status(500).json({ message: '修改密码失败' });
    }
});

// 软件相关路由

// 获取所有软件
app.get('/api/software', authenticateToken, (req, res) => {
    const softwareList = readData(SOFTWARE_FILE);
    res.json(softwareList);
});

// 添加软件
app.post('/api/software', authenticateToken, (req, res) => {
    const { name, fileType, downloadUrls } = req.body;
    
    if (!name || !fileType || !downloadUrls || downloadUrls.length === 0) {
        return res.status(400).json({ message: '请提供软件名称、文件类型和至少一个下载地址' });
    }

    const softwareList = readData(SOFTWARE_FILE);
    
    // 检查是否已存在同名软件
    const existingSoftware = softwareList.find(s => s.name === name);
    if (existingSoftware) {
        return res.status(400).json({ message: '已存在同名软件' });
    }

    const newSoftware = {
        id: generateId(),
        name,
        fileType,
        downloadUrls,
        createdAt: new Date().toISOString()
    };

    softwareList.push(newSoftware);
    
    if (writeData(SOFTWARE_FILE, softwareList)) {
        res.json(newSoftware);
    } else {
        res.status(500).json({ message: '保存软件失败' });
    }
});

// 更新软件
app.put('/api/software/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { name, fileType, downloadUrls } = req.body;
    
    if (!name || !fileType || !downloadUrls || downloadUrls.length === 0) {
        return res.status(400).json({ message: '请提供软件名称、文件类型和至少一个下载地址' });
    }

    let softwareList = readData(SOFTWARE_FILE);
    const index = softwareList.findIndex(s => s.id === id);
    
    if (index === -1) {
        return res.status(404).json({ message: '软件不存在' });
    }

    // 检查是否已存在其他同名软件
    const existingSoftware = softwareList.find(s => s.name === name && s.id !== id);
    if (existingSoftware) {
        return res.status(400).json({ message: '已存在同名软件' });
    }

    // 更新软件信息
    softwareList[index] = {
        ...softwareList[index],
        name,
        fileType,
        downloadUrls,
        updatedAt: new Date().toISOString()
    };
    
    if (writeData(SOFTWARE_FILE, softwareList)) {
        res.json(softwareList[index]);
    } else {
        res.status(500).json({ message: '更新软件失败' });
    }
});

// 删除软件
app.delete('/api/software/:id', authenticateToken, (req, res) => {
    const { id } = req.params;

    let softwareList = readData(SOFTWARE_FILE);
    const index = softwareList.findIndex(s => s.id === id);
    
    if (index === -1) {
        return res.status(404).json({ message: '软件不存在' });
    }

    // 删除软件
    softwareList.splice(index, 1);
    
    // 同时删除该软件的所有卡密
    let keysList = readData(KEYS_FILE);
    keysList = keysList.filter(key => key.softwareId !== id);
    writeData(KEYS_FILE, keysList);
    
    if (writeData(SOFTWARE_FILE, softwareList)) {
        res.json({ message: '软件删除成功' });
    } else {
        res.status(500).json({ message: '删除软件失败' });
    }
});

// 卡密相关路由

// 获取所有卡密
app.get('/api/keys', authenticateToken, (req, res) => {
    const keysList = readData(KEYS_FILE);
    const softwareList = readData(SOFTWARE_FILE);
    
    // 关联软件信息
    const keysWithSoftware = keysList.map(key => {
        const software = softwareList.find(s => s.id === key.softwareId);
        return {
            ...key,
            software
        };
    });
    
    // 按创建时间排序，最新的在前
    keysWithSoftware.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json(keysWithSoftware);
});

// 生成卡密
app.post('/api/keys', authenticateToken, (req, res) => {
    const { softwareId, count, validityDays } = req.body;
    
    if (!softwareId || !count || count < 1 || count > 100) {
        return res.status(400).json({ message: '请提供有效的软件ID和卡密数量（1-100）' });
    }

    const softwareList = readData(SOFTWARE_FILE);
    const software = softwareList.find(s => s.id === softwareId);
    
    if (!software) {
        return res.status(404).json({ message: '软件不存在' });
    }

    const keysList = readData(KEYS_FILE);
    const newKeys = [];
    
    // 生成指定数量的卡密
    for (let i = 0; i < count; i++) {
        let keyCode;
        // 确保卡密唯一
        do {
            keyCode = generateKeyCode();
        } while (keysList.some(k => k.code === keyCode) || newKeys.some(k => k.code === keyCode));
        
        let validUntil = null;
        if (validityDays > 0) {
            const date = new Date();
            date.setDate(date.getDate() + validityDays);
            validUntil = date.toISOString();
        }
        
        const newKey = {
            id: generateId(),
            code: keyCode,
            softwareId,
            validityDays,
            validUntil,
            used: false,
            createdAt: new Date().toISOString()
        };
        
        newKeys.push(newKey);
        keysList.push(newKey);
    }
    
    if (writeData(KEYS_FILE, keysList)) {
        res.json({ keys: newKeys });
    } else {
        res.status(500).json({ message: '生成卡密失败' });
    }
});

// 删除卡密
app.delete('/api/keys/:id', authenticateToken, (req, res) => {
    const { id } = req.params;

    let keysList = readData(KEYS_FILE);
    const index = keysList.findIndex(k => k.id === id);
    
    if (index === -1) {
        return res.status(404).json({ message: '卡密不存在' });
    }

    // 删除卡密
    keysList.splice(index, 1);
    
    if (writeData(KEYS_FILE, keysList)) {
        res.json({ message: '卡密删除成功' });
    } else {
        res.status(500).json({ message: '删除卡密失败' });
    }
});

// 验证卡密
app.post('/api/verify-key', (req, res) => {
    const { key } = req.body;
    
    if (!key) {
        return res.status(400).json({ message: '请提供卡密' });
    }

    const keysList = readData(KEYS_FILE);
    const softwareList = readData(SOFTWARE_FILE);
    
    // 查找卡密
    const keyData = keysList.find(k => k.code === key.trim());
    
    if (!keyData) {
        return res.status(404).json({ message: '卡密不存在' });
    }

    // 检查卡密是否已过期
    if (keyData.validUntil && new Date(keyData.validUntil) < new Date()) {
        return res.status(403).json({ message: '卡密已过期' });
    }

    // 查找对应的软件
    const software = softwareList.find(s => s.id === keyData.softwareId);
    
    if (!software) {
        return res.status(404).json({ message: '卡密对应的软件不存在' });
    }

    // 标记卡密为已使用
    keyData.used = true;
    keyData.usedAt = new Date().toISOString();
    writeData(KEYS_FILE, keysList);
    
    res.json({
        key: keyData.code,
        software,
        validUntil: keyData.validUntil,
        used: keyData.used
    });
});

// 静态页面路由
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 初始化数据文件并启动服务器
initDataFiles();

app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`管理员页面: http://localhost:${PORT}/admin`);
    console.log(`用户验证页面: http://localhost:${PORT}`);
    console.log('默认管理员账号: admin / password (请登录后立即修改密码)');
});
