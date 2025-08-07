const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');
const serverless = require('serverless-http');
const router = express.Router(); 
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置（确保CORS允许所有来源，避免跨域问题）
app.use(cors({ origin: '*' }));
app.use(bodyParser.json());
// 路由挂载（关键：所有接口必须通过此路径访问）
app.use('/.netlify/functions/server', router); 

// 密钥与路径配置
const JWT_SECRET = 'your-secret-key-here';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'password';
const DATA_DIR = path.join('/tmp', 'data');
const SOFTWARE_FILE = path.join(DATA_DIR, 'software.json');
const KEYS_FILE = path.join(DATA_DIR, 'keys.json');
const USER_FILE = path.join(DATA_DIR, 'user.json');

// 确保数据目录存在
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log('数据目录创建成功:', DATA_DIR);
  }
}

// 初始化数据文件
async function initDataFiles() {
  await ensureDataDir();
  // 初始化用户数据
  try { await fs.access(USER_FILE); } 
  catch {
    await writeData(USER_FILE, {
      username: ADMIN_USERNAME,
      password: hashPassword(ADMIN_PASSWORD),
      updatedAt: new Date().toISOString()
    });
  }
  // 初始化软件和卡密数据
  try { await fs.access(SOFTWARE_FILE); } catch { await writeData(SOFTWARE_FILE, []); }
  try { await fs.access(KEYS_FILE); } catch { await writeData(KEYS_FILE, []); }
}

// 工具函数
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, hashedPassword) {
  const [salt, hash] = hashedPassword.split(':');
  const newHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return newHash === hash;
}

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
}

// 验证令牌中间件
function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: '未提供令牌' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) return res.status(403).json({ message: '令牌无效或已过期' });
      req.user = user;
      next();
    });
  } catch (error) {
    res.status(500).json({ message: '权限验证失败' });
  }
}

// 数据读写函数
async function readData(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`读取失败 ${filePath}:`, error.message);
    return [];
  }
}

async function writeData(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`写入失败 ${filePath}:`, error.message);
    return false;
  }
}

// 生成自定义格式卡密（ABCD-EFGH-IJK）
function generateFormattedKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  // 4位 + 4位 + 3位，带分隔符
  for (let i = 0; i < 4; i++) key += chars[Math.floor(Math.random() * chars.length)];
  key += '-';
  for (let i = 0; i < 4; i++) key += chars[Math.floor(Math.random() * chars.length)];
  key += '-';
  for (let i = 0; i < 3; i++) key += chars[Math.floor(Math.random() * chars.length)];
  return key;
}

// 登录接口
router.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: '请提供用户名和密码' });

    const user = await readData(USER_FILE);
    if (user.username !== username || !verifyPassword(password, user.password)) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }

    res.json({ token: generateToken(user.username) });
  } catch (error) {
    res.status(500).json({ message: '服务器错误' });
  }
});

// 修改密码接口
router.post('/api/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: '请提供当前密码和新密码' });

    const user = await readData(USER_FILE);
    if (!verifyPassword(currentPassword, user.password)) {
      return res.status(401).json({ message: '当前密码错误' });
    }

    user.password = hashPassword(newPassword);
    user.updatedAt = new Date().toISOString();
    await writeData(USER_FILE, user);
    res.json({ message: '密码修改成功' });
  } catch (error) {
    res.status(500).json({ message: '服务器错误' });
  }
});

// 软件相关接口
router.get('/api/software', authenticateToken, async (req, res) => {
  try {
    const softwareList = await readData(SOFTWARE_FILE);
    res.json(softwareList);
  } catch (error) {
    res.status(500).json({ message: '获取软件列表失败' });
  }
});

router.post('/api/software', authenticateToken, async (req, res) => {
  try {
    const { name, fileType, downloadUrls } = req.body;
    if (!name || !fileType || !downloadUrls?.length) {
      return res.status(400).json({ message: '请填写软件名称、类型和至少一个下载地址' });
    }

    const softwareList = await readData(SOFTWARE_FILE);
    const newSoftware = { id: uuidv4(), name, fileType, downloadUrls, createdAt: new Date().toISOString() };
    softwareList.push(newSoftware);
    await writeData(SOFTWARE_FILE, softwareList);
    res.json(newSoftware);
  } catch (error) {
    res.status(500).json({ message: '服务器错误' });
  }
});

router.put('/api/software/:id', authenticateToken, async (req, res) => {
  try {
    const { name, fileType, downloadUrls } = req.body;
    const softwareId = req.params.id;
    if (!name || !fileType || !downloadUrls?.length) {
      return res.status(400).json({ message: '请填写软件名称、类型和至少一个下载地址' });
    }

    const softwareList = await readData(SOFTWARE_FILE);
    const index = softwareList.findIndex(s => s.id === softwareId);
    if (index === -1) return res.status(404).json({ message: '软件不存在' });

    softwareList[index] = { ...softwareList[index], name, fileType, downloadUrls, updatedAt: new Date().toISOString() };
    await writeData(SOFTWARE_FILE, softwareList);
    res.json(softwareList[index]);
  } catch (error) {
    res.status(500).json({ message: '服务器错误' });
  }
});

router.delete('/api/software/:id', authenticateToken, async (req, res) => {
  try {
    const softwareId = req.params.id;
    let softwareList = await readData(SOFTWARE_FILE);
    const updatedSoftware = softwareList.filter(s => s.id !== softwareId);
    if (softwareList.length === updatedSoftware.length) return res.status(404).json({ message: '软件不存在' });

    let keysList = await readData(KEYS_FILE);
    const updatedKeys = keysList.filter(k => k.softwareId !== softwareId);
    
    await writeData(SOFTWARE_FILE, updatedSoftware);
    await writeData(KEYS_FILE, updatedKeys);
    res.json({ message: '软件删除成功' });
  } catch (error) {
    res.status(500).json({ message: '服务器错误' });
  }
});

// 卡密相关接口
router.get('/api/keys', authenticateToken, async (req, res) => {
  try {
    const keysList = await readData(KEYS_FILE);
    const softwareList = await readData(SOFTWARE_FILE);
    const keysWithSoftware = keysList.map(key => ({
      ...key,
      software: softwareList.find(s => s.id === key.softwareId)
    }));
    res.json(keysWithSoftware);
  } catch (error) {
    res.status(500).json({ message: '获取卡密列表失败' });
  }
});

router.post('/api/keys', authenticateToken, async (req, res) => {
  try {
    const { softwareId, count, validityDays } = req.body;
    if (!softwareId || !count || count <= 0) {
      return res.status(400).json({ message: '请选择软件并输入有效的卡密数量' });
    }

    const softwareList = await readData(SOFTWARE_FILE);
    if (!softwareList.find(s => s.id === softwareId)) {
      return res.status(404).json({ message: '软件不存在' });
    }

    const keysList = await readData(KEYS_FILE);
    const newKeys = [];
    for (let i = 0; i < count; i++) {
      const keyCode = generateFormattedKey();
      const newKey = {
        id: uuidv4(),
        code: keyCode,
        softwareId,
        used: false,
        createdAt: new Date().toISOString(),
        validUntil: validityDays ? new Date(Date.now() + validityDays * 86400000).toISOString() : null
      };
      newKeys.push(newKey);
      keysList.push(newKey);
    }

    await writeData(KEYS_FILE, keysList);
    res.json({ keys: newKeys });
  } catch (error) {
    res.status(500).json({ message: '服务器错误' });
  }
});

router.delete('/api/keys/:id', authenticateToken, async (req, res) => {
  try {
    const keyId = req.params.id;
    let keysList = await readData(KEYS_FILE);
    const updatedKeys = keysList.filter(k => k.id !== keyId);
    if (keysList.length === updatedKeys.length) return res.status(404).json({ message: '卡密不存在' });

    await writeData(KEYS_FILE, updatedKeys);
    res.json({ message: '卡密删除成功' });
  } catch (error) {
    res.status(500).json({ message: '服务器错误' });
  }
});

// 验证卡密接口（核心修复：返回完整软件信息）
router.post('/api/verify-key', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: '请提供卡密' });

    const keysList = await readData(KEYS_FILE);
    const key = keysList.find(k => k.code === code.trim());
    if (!key) return res.status(404).json({ message: '卡密不存在', valid: false });
    if (key.used) return res.json({ message: '卡密已使用', valid: false, used: true });
    if (key.validUntil && new Date(key.validUntil) < new Date()) {
      return res.json({ message: '卡密已过期', valid: false, expired: true });
    }

    // 关键：查询并返回完整软件信息（前端需要显示下载链接）
    const softwareList = await readData(SOFTWARE_FILE);
    const software = softwareList.find(s => s.id === key.softwareId);
    
    res.json({ 
      valid: true, 
      message: '卡密有效',
      software, // 返回完整软件信息
      validUntil: key.validUntil
    });
  } catch (error) {
    console.error('验证卡密错误:', error.message);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 初始化数据
initDataFiles().catch(error => console.error('初始化失败:', error.message));

// 本地运行
if (require.main === module) {
  app.listen(PORT, () => console.log(`本地服务器运行在 http://localhost:${PORT}`));
}

// 导出Netlify处理器
module.exports.handler = serverless(app);
