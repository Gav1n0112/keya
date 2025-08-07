const express = require('express');
const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 初始化Express应用
const app = express();
const router = express.Router(); // 新增这一行

// 中间件（和原来一样）
app.use(cors());
app.use(bodyParser.json());

// 【重点修改】数据存储路径改写成绝对路径（Netlify需要）
const DATA_DIR = path.join(process.cwd(), 'data'); // 替换原来的path.join(__dirname, 'data')
// 下面的SOFTWARE_FILE、KEYS_FILE、USER_FILE保持不变

// 密钥和原来一样（记得改！）
const JWT_SECRET = '你的密钥'; 
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'password';

// 后面的函数（hashPassword、verifyPassword、generateToken等）全部保留

// 【重点修改】所有路由前面加 '/.netlify/functions/api'
// 例如原来的 app.post('/api/login' 改成 router.post('/api/login'
router.post('/api/login', (req, res) => { ... }); // 所有接口都用router
router.post('/api/change-password', authenticateToken, (req, res) => { ... });
// 其他路由同理，全部替换成router

// 静态文件托管（前端页面）
app.use(express.static(path.join(process.cwd(), 'public'))); // 路径改写成process.cwd()

// 最后添加这两行
app.use('/.netlify/functions/api', router);
module.exports.handler = serverless(app);