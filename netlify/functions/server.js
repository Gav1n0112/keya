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
const { v4: uuidv4 } = require('uuid'); // 用于生成唯一ID

// 初始化Express应用
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(cors());
app.use(bodyParser.json());
// 关键：将所有路由挂载到Netlify Functions路径
app.use('/.netlify/functions/server', router); 

// 密钥配置（建议生产环境改为环境变量）
const JWT_SECRET = 'your-secret-key-here'; // 保持与前端登录一致
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'password'; // 初始密码

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
    console.log('数据目录创建成功:', DATA_DIR);
  }
}

// 初始化数据文件
async function initDataFiles() {
  await ensureDataDir();
  // 初始化用户数据
  try {
    await fs.access(USER_FILE);
    console.log('用户数据文件已存在');
  } catch {
    const initialUser = {
      username: ADMIN_USERNAME,
      password: hashPassword(ADMIN_PASSWORD),
      updatedAt: new Date().toISOString()
    };
    await writeData(USER_FILE, initialUser);
    console.log('初始化用户数据文件成功');
  }
  // 初始化软件数据
  try {
    await fs.access(SOFTWARE_FILE);
    console.log('软件数据文件已存在');
  } catch {
    await writeData(SOFTWARE_FILE, []);
    console.log('初始化软件数据文件成功');
  }
  // 初始化卡密数据
  try {
    await fs.access(KEYS_FILE);
    console.log('卡密数据文件已存在');
  } catch {
    await writeData(KEYS_FILE, []);
    console.log('初始化卡密数据文件成功');
  }
}

// 密码哈希函数
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// 密码验证函数
function verifyPassword(password, hashedPassword) {
  const [salt, hash] = hashedPassword.split(':');
  const newHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return newHash === hash;
}

// 生成JWT令牌
function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
}

// 验证令牌中间件（添加错误处理）
function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    console.log('授权头:', authHeader);
    
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      console.log('未提供token');
      return res.status(401).json({ message: '未提供令牌' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        console.log('token验证失败:', err.message);
        return res.status(403).json({ message: '令牌无效或已过期' });
      }
      req.user = user;
      console.log('token验证成功:', user);
      next();
    });
  } catch (error) {
    console.log('权限中间件错误:', error.message);
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
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; // 允许的字符（大写字母+数字）
  let key = '';
  
  // 第一部分：4个字符
  for (let i = 0; i < 4; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  key += '-'; // 添加分隔符
  
  // 第二部分：4个字符
  for (let i = 0; i < 4; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  key += '-'; // 添加分隔符
  
  // 第三部分：3个字符
  for (let i = 0; i < 3; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return key;
}

// 登录接口
router.post('/api/login', async (req, res) => {
  try {
    console.log('收到登录请求');
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: '请提供用户名和密码' });
    }

    const user = await readData(USER_FILE);
    if (!user) {
      return res.status(500).json({ message: '用户数据加载失败' });
    }

    if (user.username !== username || !verifyPassword(password, user.password)) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }

    const token = generateToken(user.username);
    console.log('登录成功，生成token');
    res.json({ token });
  } catch (error) {
    console.error('登录接口错误:', error.message);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 修改密码接口
router.post('/api/change-password', authenticateToken, async (req, res) => {
  try {
    console.log('收到修改密码请求');
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: '请提供当前密码和新密码' });
    }

    const user = await readData(USER_FILE);
    if (!user) {
      return res.status(500).json({ message: '用户数据加载失败' });
    }

    // 验证当前密码
    if (!verifyPassword(currentPassword, user.password)) {
      return res.status(401).json({ message: '当前密码错误' });
    }

    // 更新密码
    user.password = hashPassword(newPassword);
    user.updatedAt = new Date().toISOString();
    const success = await writeData(USER_FILE, user);
    
    if (success) {
      console.log('密码修改成功');
      res.json({ message: '密码修改成功' });
    } else {
      res.status(500).json({ message: '密码修改失败' });
    }
  } catch (error) {
    console.error('修改密码接口错误:', error.message);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 软件相关接口
// 获取软件列表
router.get('/api/software', authenticateToken, async (req, res) => {
  try {
    console.log('收到获取软件列表请求');
    const softwareList = await readData(SOFTWARE_FILE);
    console.log('软件列表加载成功，数量:', softwareList.length);
    res.json(softwareList);
  } catch (error) {
    console.error('获取软件列表错误:', error.message);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({ message: '获取软件列表失败', error: error.message });
  }
});

// 添加软件
router.post('/api/software', authenticateToken, async (req, res) => {
  try {
    console.log('收到添加软件请求');
    const { name, fileType, downloadUrls } = req.body;
    
    if (!name || !fileType || !downloadUrls || downloadUrls.length === 0) {
      return res.status(400).json({ message: '请填写软件名称、类型和至少一个下载地址' });
    }

    const softwareList = await readData(SOFTWARE_FILE);
    const newSoftware = {
      id: uuidv4(), // 生成唯一ID
      name,
      fileType,
      downloadUrls,
      createdAt: new Date().toISOString()
    };

    softwareList.push(newSoftware);
    const success = await writeData(SOFTWARE_FILE, softwareList);
    
    if (success) {
      console.log('软件添加成功:', name);
      res.json(newSoftware);
    } else {
      res.status(500).json({ message: '软件添加失败' });
    }
  } catch (error) {
    console.error('添加软件错误:', error.message);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新软件
router.put('/api/software/:id', authenticateToken, async (req, res) => {
  try {
    console.log('收到更新软件请求，ID:', req.params.id);
    const { name, fileType, downloadUrls } = req.body;
    const softwareId = req.params.id;
    
    if (!name || !fileType || !downloadUrls || downloadUrls.length === 0) {
      return res.status(400).json({ message: '请填写软件名称、类型和至少一个下载地址' });
    }

    const softwareList = await readData(SOFTWARE_FILE);
    const index = softwareList.findIndex(s => s.id === softwareId);
    
    if (index === -1) {
      return res.status(404).json({ message: '软件不存在' });
    }

    // 更新软件信息
    softwareList[index] = {
      ...softwareList[index],
      name,
      fileType,
      downloadUrls,
      updatedAt: new Date().toISOString()
    };

    const success = await writeData(SOFTWARE_FILE, softwareList);
    
    if (success) {
      console.log('软件更新成功:', name);
      res.json(softwareList[index]);
    } else {
      res.status(500).json({ message: '软件更新失败' });
    }
  } catch (error) {
    console.error('更新软件错误:', error.message);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 删除软件
router.delete('/api/software/:id', authenticateToken, async (req, res) => {
  try {
    console.log('收到删除软件请求，ID:', req.params.id);
    const softwareId = req.params.id;

    // 删除软件
    const softwareList = await readData(SOFTWARE_FILE);
    const updatedSoftwareList = softwareList.filter(s => s.id !== softwareId);
    
    if (softwareList.length === updatedSoftwareList.length) {
      return res.status(404).json({ message: '软件不存在' });
    }

    // 同时删除关联的卡密
    const keysList = await readData(KEYS_FILE);
    const updatedKeysList = keysList.filter(k => k.softwareId !== softwareId);

    // 保存修改
    const softwareSuccess = await writeData(SOFTWARE_FILE, updatedSoftwareList);
    const keysSuccess = await writeData(KEYS_FILE, updatedKeysList);
    
    if (softwareSuccess && keysSuccess) {
      console.log('软件及关联卡密删除成功');
      res.json({ message: '软件删除成功' });
    } else {
      res.status(500).json({ message: '软件删除失败' });
    }
  } catch (error) {
    console.error('删除软件错误:', error.message);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 卡密相关接口
// 获取卡密列表
router.get('/api/keys', authenticateToken, async (req, res) => {
  try {
    console.log('收到获取卡密列表请求');
    const keysList = await readData(KEYS_FILE);
    const softwareList = await readData(SOFTWARE_FILE);
    
    // 关联软件信息
    const keysWithSoftware = keysList.map(key => {
      const software = softwareList.find(s => s.id === key.softwareId);
      return { ...key, software };
    });

    console.log('卡密列表加载成功，数量:', keysWithSoftware.length);
    res.json(keysWithSoftware);
  } catch (error) {
    console.error('获取卡密列表错误:', error.message);
    res.status(500).json({ message: '获取卡密列表失败' });
  }
});

// 生成卡密（使用自定义格式）
router.post('/api/keys', authenticateToken, async (req, res) => {
  try {
    console.log('收到生成卡密请求');
    const { softwareId, count, validityDays } = req.body;
    
    if (!softwareId || !count || count <= 0) {
      return res.status(400).json({ message: '请选择软件并输入有效的卡密数量' });
    }

    // 验证软件是否存在
    const softwareList = await readData(SOFTWARE_FILE);
    const software = softwareList.find(s => s.id === softwareId);
    if (!software) {
      return res.status(404).json({ message: '软件不存在' });
    }

    // 生成卡密（使用自定义格式函数）
    const keysList = await readData(KEYS_FILE);
    const newKeys = [];
    
    for (let i = 0; i < count; i++) {
      const keyCode = generateFormattedKey(); // 调用自定义格式生成函数
      const newKey = {
        id: uuidv4(),
        code: keyCode,
        softwareId,
        used: false,
        createdAt: new Date().toISOString(),
        validUntil: validityDays ? new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString() : null
      };
      newKeys.push(newKey);
      keysList.push(newKey);
    }

    // 保存卡密
    const success = await writeData(KEYS_FILE, keysList);
    
    if (success) {
      console.log(`成功生成 ${count} 个卡密`);
      res.json({ keys: newKeys });
    } else {
      res.status(500).json({ message: '卡密生成失败' });
    }
  } catch (error) {
    console.error('生成卡密错误:', error.message);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 删除卡密
router.delete('/api/keys/:id', authenticateToken, async (req, res) => {
  try {
    console.log('收到删除卡密请求，ID:', req.params.id);
    const keyId = req.params.id;

    const keysList = await readData(KEYS_FILE);
    const updatedKeysList = keysList.filter(k => k.id !== keyId);
    
    if (keysList.length === updatedKeysList.length) {
      return res.status(404).json({ message: '卡密不存在' });
    }

    const success = await writeData(KEYS_FILE, updatedKeysList);
    
    if (success) {
      console.log('卡密删除成功');
      res.json({ message: '卡密删除成功' });
    } else {
      res.status(500).json({ message: '卡密删除失败' });
    }
  } catch (error) {
    console.error('删除卡密错误:', error.message);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 验证卡密（公开接口）
router.post('/api/verify-key', async (req, res) => {
  try {
    console.log('收到验证卡密请求');
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ message: '请提供卡密' });
    }

    const keysList = await readData(KEYS_FILE);
    const key = keysList.find(k => k.code === code.trim());
    
    if (!key) {
      return res.status(404).json({ message: '卡密不存在', valid: false });
    }

    if (key.used) {
      return res.json({ message: '卡密已使用', valid: false, used: true });
    }

    if (key.validUntil && new Date(key.validUntil) < new Date()) {
      return res.json({ message: '卡密已过期', valid: false, expired: true });
    }

    // 验证通过（不标记为已使用，由客户端决定何时标记）
    res.json({ 
      valid: true, 
      message: '卡密有效',
      softwareId: key.softwareId
    });
  } catch (error) {
    console.error('验证卡密错误:', error.message);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 初始化数据并启动服务
initDataFiles().catch(error => console.error('初始化失败:', error.message));

// 本地运行配置
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`本地服务器运行在 http://localhost:${PORT}`);
  });
}

// 导出Netlify处理器（必须）
module.exports.handler = serverless(app);
