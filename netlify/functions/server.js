const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const serverless = require('serverless-http');
const router = express.Router(); // 路由对象（关键）
const crypto = require('crypto');

// 初始化Express应用
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(cors());
app.use(bodyParser.json());
// 关键：将所有路由挂载到Netlify Functions路径
app.use('/.netlify/functions/server', router); 

// 密钥配置
const JWT_SECRET = 'your-secret-key-here';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'password';

// 数据存储路径（使用Netlify临时目录）
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
  }
}

// 初始化数据文件
async function initDataFiles() {
  await ensureDataDir();
  // 初始化用户数据
  try {
    await fs.access(USER_FILE);
  } catch {
    const initialUser = {
      username: ADMIN_USERNAME,
      password: hashPassword(ADMIN_PASSWORD),
      updatedAt: new Date().toISOString()
    };
    await writeData(USER_FILE, initialUser);
  }
  // 初始化软件和卡密数据（略，保持原样）
  try { await fs.access(SOFTWARE_FILE); } catch { await writeData(SOFTWARE_FILE, []); }
  try { await fs.access(KEYS_FILE); } catch { await writeData(KEYS_FILE, []); }
}

// 工具函数（哈希、验证密码等，保持原样）
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

// 验证令牌中间件（保持原样）
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: '未提供令牌' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: '令牌无效' });
    req.user = user;
    next();
  });
}

// 读写数据函数（保持原样）
async function readData(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`读取失败 ${filePath}:`, error);
    return [];
  }
}

async function writeData(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`写入失败 ${filePath}:`, error);
    return false;
  }
}

// 核心修改：所有接口必须用router定义，而不是app！
// 登录接口（关键修改：app.post → router.post）
router.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: '请提供用户名和密码' });
    }
    const user = await readData(USER_FILE);
    if (user.username !== username || !verifyPassword(password, user.password)) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }
    const token = generateToken(user.username);
    res.json({ token });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 其他接口也必须用router（示例：修改密码）
router.post('/api/change-password', authenticateToken, async (req, res) => {
  // 代码保持原样，只需将app.post改为router.post
});

// 软件相关接口（全部改为router.xxx）
router.get('/api/software', authenticateToken, async (req, res) => { /* ... */ });
router.post('/api/software', authenticateToken, async (req, res) => { /* ... */ });
router.put('/api/software/:id', authenticateToken, async (req, res) => { /* ... */ });
router.delete('/api/software/:id', authenticateToken, async (req, res) => { /* ... */ });

// 卡密相关接口（全部改为router.xxx）
router.get('/api/keys', authenticateToken, async (req, res) => { /* ... */ });
router.post('/api/keys', authenticateToken, async (req, res) => { /* ... */ });
router.delete('/api/keys/:id', authenticateToken, async (req, res) => { /* ... */ });
router.post('/api/verify-key', async (req, res) => { /* ... */ });

// 移除静态页面路由（Netlify会直接托管public目录，无需后端处理）
// 注释掉所有app.get('/login'), app.get('/admin'), app.get('/')

// 初始化数据并启动服务
initDataFiles().catch(error => console.error('初始化失败:', error));

// 本地运行配置
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`本地服务器运行在 http://localhost:${PORT}`);
  });
}

// 导出Netlify处理器（必须）
module.exports.handler = serverless(app);
