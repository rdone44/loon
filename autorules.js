// 自动下载分流规则脚本
const $ = new Env('AutoRules');
const REPO_URL = 'https://raw.githubusercontent.com/luestr/ShuntRules/main/';

// 添加配置文件路径
const CONFIG_PATH = 'loon.conf';
const RULE_CACHE = new Set();

async function downloadRule(domain) {
  try {
    // 1. 从请求域名提取关键词
    const keyword = extractKeyword(domain);
    
    // 2. 检查规则是否已存在
    if (RULE_CACHE.has(keyword)) {
      $.log(`规则 ${keyword} 已存在,跳过下载`);
      return;
    }
    
    // 3. 查找匹配的规则文件
    const ruleFile = await findRuleFile(keyword);
    if (!ruleFile) {
      $.log(`未找到域名 ${domain} 对应的规则文件`);
      return;
    }
    
    // 4. 下载规则文件
    const ruleContent = await download(`${REPO_URL}Loon/${ruleFile}`);
    
    // 5. 添加到Loon配置
    await addRule(keyword, ruleContent);
    
    // 6. 添加到缓存
    RULE_CACHE.add(keyword);
    
    $.log(`成功下载并添加规则: ${ruleFile}`);
    
  } catch (err) {
    $.log(`下载规则失败: ${err}`);
  }
}

// 提取域名关键词
function extractKeyword(domain) {
  // 优化关键词提取逻辑
  const parts = domain.split('.');
  if (parts.length < 2) return domain;
  
  // 处理特殊域名
  if (parts.length > 2 && ['com', 'org', 'net'].includes(parts[parts.length-1])) {
    return parts[parts.length-2];
  }
  return parts[1];
}

// 查找匹配的规则文件
async function findRuleFile(keyword) {
  try {
    // 获取仓库规则列表
    const files = await $.http.get(`${REPO_URL}Loon/`).body;
    const ruleFiles = files.match(/[A-Za-z0-9-]+\.list/g) || [];
    
    // 查找最匹配的规则文件
    return ruleFiles.find(file => 
      file.toLowerCase().includes(keyword.toLowerCase())
    );
  } catch (err) {
    $.log(`查找规则文件失败: ${err}`);
    return null;
  }
}

// 下载规则文件
async function download(url) {
  const response = await $.http.get(url);
  if (response.statusCode !== 200) {
    throw new Error(`下载失败: ${response.statusCode}`);
  }
  return response.body;
}

// 添加规则到Loon配置
async function addRule(keyword, content) {
  try {
    // 1. 读取现有配置
    let config = await readConfig();
    if (!config) {
      throw new Error('无法读取配置文件');
    }

    // 2. 解析配置文件各个部分
    const sections = parseSections(config);
    
    // 3. 解析新规则内容
    const rules = parseRules(content);
    
    // 4. 在[Rule]部分添加新规则组
    if (!sections.rule) {
      sections.rule = '[Rule]\n';
    }
    
    sections.rule += `\n# ${keyword} 规则组\n`;
    for (const rule of rules) {
      if (!sections.rule.includes(rule)) {
        sections.rule += `${rule}\n`;
      }
    }
    
    // 5. 重新组装配置文件
    const newConfig = assembleSections(sections);
    
    // 6. 写入配置文件
    await writeConfig(newConfig);
    
    $.notify('规则更新', '', `成功添加 ${keyword} 规则组`);
    
  } catch (err) {
    $.log(`添加规则失败: ${err}`);
    throw err;
  }
}

// 解析配置文件各个部分
function parseSections(config) {
  const sections = {
    general: '',
    proxy: '',
    'proxy-group': '',
    rule: '',
    other: ''
  };
  
  let currentSection = 'other';
  
  config.split('\n').forEach(line => {
    if (line.match(/^\[(.*)\]/)) {
      currentSection = line.match(/^\[(.*)\]/)[1].toLowerCase();
      if (!sections[currentSection]) {
        sections[currentSection] = '';
      }
    }
    sections[currentSection] += line + '\n';
  });
  
  return sections;
}

// 重新组装配置文件
function assembleSections(sections) {
  return Object.values(sections).join('\n');
}

// 解析规则内容
function parseRules(content) {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(rule => {
      // 确保规则格式正确
      if (!rule.includes(',')) {
        return null;
      }
      const parts = rule.split(',');
      if (parts.length < 3) {
        return null;
      }
      return rule;
    })
    .filter(rule => rule !== null);
}

// 读取配置文件
async function readConfig() {
  try {
    const config = await $.read(CONFIG_PATH);
    if (!config) {
      // 如果配置文件不存在,使用默认模板
      const defaultConfig = await $.http.get('https://raw.githubusercontent.com/luestr/ProxyResource/main/Tool/Loon/Config/zh-CN/Loon_Sample_Configuration_By_iKeLee.conf').body;
      await writeConfig(defaultConfig);
      return defaultConfig;
    }
    return config;
  } catch (err) {
    $.log(`读取配置失败: ${err}`);
    return null;
  }
}

// 写入配置文件
async function writeConfig(content) {
  try {
    await $.write(content, CONFIG_PATH);
  } catch (err) {
    throw new Error(`写入配置失败: ${err}`);
  }
}

// 脚本入口
!(async () => {
  const domain = $request.hostname;
  await downloadRule(domain);
})()
.catch((e) => $.log('', `❌ ${$.name}, 错误! 原因: ${e}!`, ''))
.finally(() => $.done()); 