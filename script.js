/**
 * 大宝导航 (Dabao Navigator)
 * Chrome浏览器标签管理插件
 * 功能：新标签页替换、标签分类管理、数据本地存储、烟花动画背景
 */

// 全局变量
let currentData = {
    categories: []
};

let currentEditTab = null;
let currentEditCategory = null;
let confirmCallback = null;
let searchTimeout = null;

/**
 * 初始化应用
 */
async function init() {
    await loadData();
    renderCategories();
    bindEvents();
    initParticles();
}

/**
 * 加载数据
 * 从chrome.storage.local加载数据，如果没有则使用默认数据
 */
async function loadData() {
    try {
        const result = await chrome.storage.local.get('tabhubData');
        if (result.tabhubData) {
            currentData = result.tabhubData;
        } else {
            // 首次加载，使用默认数据
            const response = await fetch('tabs.json');
            const defaultData = await response.json();
            currentData = defaultData;
            await saveData();
        }
    } catch (error) {
        console.error('加载数据失败:', error);
        // 使用默认数据
        currentData = {
            categories: [
                {
                    id: "1",
                    name: "常用工具",
                    tabs: [
                        {
                            id: "1-1",
                            name: "Google",
                            url: "https://www.google.com",
                            icon: "https://www.google.com/favicon.ico"
                        },
                        {
                            id: "1-2",
                            name: "GitHub",
                            url: "https://github.com",
                            icon: "https://github.com/favicon.ico"
                        }
                    ]
                }
            ]
        };
        await saveData();
    }
}

/**
 * 保存数据
 * 将数据保存到chrome.storage.local
 */
async function saveData() {
    try {
        await chrome.storage.local.set({ tabhubData: currentData });
    } catch (error) {
        console.error('保存数据失败:', error);
    }
}

/**
 * 渲染分类和标签
 * 根据搜索条件过滤并渲染分类和标签
 */
function renderCategories() {
    const mainContent = document.getElementById('mainContent');
    const searchInput = document.getElementById('searchInput').value.toLowerCase();
    
    // 使用DocumentFragment减少DOM操作次数
    const fragment = document.createDocumentFragment();
    
    if (currentData.categories.length === 0) {
        const emptyStateElement = document.createElement('div');
        emptyStateElement.className = 'empty-state';
        emptyStateElement.innerHTML = `
            <div class="empty-state-icon">📁</div>
            <p>暂无分类，请添加分类</p>
        `;
        fragment.appendChild(emptyStateElement);
    } else {
        currentData.categories.forEach(category => {
            // 过滤标签
            const filteredTabs = category.tabs.filter(tab => 
                tab.name.toLowerCase().includes(searchInput) || 
                tab.url.toLowerCase().includes(searchInput)
            );
            
            // 如果分类下没有标签且有搜索内容，跳过
            if (filteredTabs.length === 0 && searchInput) {
                return;
            }
            
            const categoryElement = document.createElement('div');
            categoryElement.className = 'category';
            categoryElement.innerHTML = `
                <div class="category-header">
                    <h2 class="category-title">${category.name}</h2>
                    <div class="category-actions">
                        <button class="btn btn-small btn-outline edit-category" data-category-id="${category.id}">重命名</button>
                        <button class="btn btn-small btn-outline delete-category" data-category-id="${category.id}">删除</button>
                    </div>
                </div>
                <div class="tabs-container" id="tabs-${category.id}">
                    ${filteredTabs.length > 0 ? filteredTabs.map(tab => `
                        <div class="tab-card" data-url="${tab.url}">
                            <div class="tab-icon">
                                ${tab.icon ? `
                                    <img src="${tab.icon}" alt="${tab.name}" class="tab-favicon" data-tab-name="${tab.name}" />
                                ` : `
                                    <div class="default-icon">🌐</div>
                                `}
                            </div>
                            ${tab.name}
                            <div class="tab-actions">
                                <div class="action-icon edit-tab" data-category-id="${category.id}" data-tab-id="${tab.id}">✏️</div>
                                <div class="action-icon delete-tab" data-category-id="${category.id}" data-tab-id="${tab.id}">🗑️</div>
                            </div>
                        </div>
                    `).join('') : `
                        <div class="empty-state">
                            <p>暂无标签，请添加标签</p>
                        </div>
                    `}
                </div>
            `;
            
            fragment.appendChild(categoryElement);
        });
    }
    
    // 清空并添加新内容
    mainContent.innerHTML = '';
    mainContent.appendChild(fragment);
    
    // 为favicon图片添加错误处理
    document.querySelectorAll('.tab-favicon').forEach(img => {
        img.addEventListener('error', function() {
            this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTAgMThjLTQuNDEgMC04LTMuNTktOC04czMuNTktOCA4LTggOCAzLjU5IDggOCAzLjU5IDggOCA4LTguMTYgMC0xMC0xLjg0eiIgZmlsbD0iI2ZmZiIgZmlsbC1vcGFjaXR5PSIwLjciLz48cGF0aCBkPSJNMTAgN2MtMS4xIDAtMi4wMS45MS0yIDJzLjkgMiAyIDIgMi0uOTEgMi0yLS45MS0yLTItMnptMCAxMGMtMS4xIDAtMi4wMS0uOTEtMi0ycy45LTEgMi0xIDIgLjkgMiAyLS45IDItMiAyem01LTYgMS40MSAxLjQxIDAtLjE3aC4xN3YtLjE3bC0xLjQxLTEuNDF6bTAtLjE3djEuN2wtMS40MS0xLjQxIDAtLjE3aDEuN2wtLjAyIDAtLjAyLS4wMi0uMDItLjAyem0tLjE3IDAtLjE3LS4xN3YtLjE3bC4xNy0uMTh6bTAtLjE3djEuN2wuMTctLjE4IDAtLjE3aC0xLjdzLS4wMi0uMDItLjAyLS4wMnptMC4xNyAwIDAtLjE3di0uMTRoLS4xN3YtLjEzbC4xNy0uMTh6IiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMS41IiBmaWxsPSJub25lIi8+PC9zdmc+';
        });
    });
}

/**
 * 绑定事件
 * 使用事件委托优化事件处理
 */
function bindEvents() {
    // 添加标签按钮
    document.getElementById('addTabBtn').addEventListener('click', () => {
        openTabModal();
    });
    
    // 导入按钮
    document.getElementById('importBtn').addEventListener('click', importData);
    
    // 导出按钮
    document.getElementById('exportBtn').addEventListener('click', exportData);
    
    // 添加分类按钮
    document.getElementById('addCategoryBtn').addEventListener('click', () => {
        openCategoryModal();
    });
    
    // 搜索框 - 使用防抖优化
    document.getElementById('searchInput').addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(renderCategories, 300);
    });
    
    // 标签对话框
    document.getElementById('tabModalCancel').addEventListener('click', closeTabModal);
    document.getElementById('tabModalSave').addEventListener('click', saveTab);
    
    // 分类对话框
    document.getElementById('categoryModalCancel').addEventListener('click', closeCategoryModal);
    document.getElementById('categoryModalSave').addEventListener('click', saveCategory);
    
    // 确认对话框
    document.getElementById('confirmCancel').addEventListener('click', closeConfirmModal);
    document.getElementById('confirmOk').addEventListener('click', () => {
        if (confirmCallback) {
            confirmCallback();
            closeConfirmModal();
        }
    });
    
    // 事件委托 - 分类操作
    document.getElementById('mainContent').addEventListener('click', function(e) {
        // 编辑分类
        if (e.target.classList.contains('edit-category')) {
            const categoryId = e.target.dataset.categoryId;
            editCategory(categoryId);
            return;
        }
        
        // 删除分类
        if (e.target.classList.contains('delete-category')) {
            const categoryId = e.target.dataset.categoryId;
            deleteCategory(categoryId);
            return;
        }
        
        // 编辑标签
        if (e.target.classList.contains('edit-tab')) {
            e.stopPropagation();
            const categoryId = e.target.dataset.categoryId;
            const tabId = e.target.dataset.tabId;
            editTab(categoryId, tabId);
            return;
        }
        
        // 删除标签
        if (e.target.classList.contains('delete-tab')) {
            e.stopPropagation();
            const categoryId = e.target.dataset.categoryId;
            const tabId = e.target.dataset.tabId;
            deleteTab(categoryId, tabId);
            return;
        }
        
        // 打开标签（必须在编辑/删除标签判断之后，避免冲突）
        const tabCard = e.target.closest('.tab-card');
        if (tabCard) {
            const url = tabCard.dataset.url;
            openTab(url);
        }
    });
}

/**
 * 打开标签
 * @param {string} url - 标签URL
 */
function openTab(url) {
    window.open(url, '_blank');
}

/**
 * 打开标签对话框
 * @param {Object} tab - 标签对象（编辑时传入）
 * @param {string} categoryId - 分类ID
 */
function openTabModal(tab = null, categoryId = null) {
    currentEditTab = tab;
    const modal = document.getElementById('tabModal');
    const title = document.getElementById('tabModalTitle');
    const form = document.getElementById('tabForm');
    const categorySelect = document.getElementById('tabCategory');
    
    // 清空表单
    form.reset();
    
    // 填充分类选项
    categorySelect.innerHTML = '';
    currentData.categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.name;
        categorySelect.appendChild(option);
    });
    
    if (tab) {
        title.textContent = '编辑标签';
        document.getElementById('tabName').value = tab.name;
        document.getElementById('tabUrl').value = tab.url;
        document.getElementById('tabIcon').value = tab.icon || '';
        document.getElementById('tabCategory').value = categoryId;
    } else {
        title.textContent = '添加标签';
    }
    
    modal.classList.add('show');
}

/**
 * 关闭标签对话框
 */
function closeTabModal() {
    const modal = document.getElementById('tabModal');
    modal.classList.remove('show');
    currentEditTab = null;
}

/**
 * 保存标签
 */
async function saveTab() {
    const name = document.getElementById('tabName').value.trim();
    let url = document.getElementById('tabUrl').value.trim();
    const icon = document.getElementById('tabIcon').value.trim();
    const categoryId = document.getElementById('tabCategory').value;
    
    // 数据验证
    if (!name || !url || !categoryId) {
        alert('请填写完整信息');
        return;
    }
    
    // 确保URL格式正确
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    
    if (currentEditTab) {
        // 编辑现有标签
        const category = currentData.categories.find(c => c.id === categoryId);
        if (category) {
            const tab = category.tabs.find(t => t.id === currentEditTab.id);
            if (tab) {
                tab.name = name;
                tab.url = url;
                tab.icon = icon;
            }
        }
    } else {
        // 添加新标签
        const category = currentData.categories.find(c => c.id === categoryId);
        if (category) {
            const newTab = {
                id: `${categoryId}-${Date.now()}`,
                name: name,
                url: url,
                icon: icon
            };
            category.tabs.push(newTab);
        }
    }
    
    await saveData();
    renderCategories();
    closeTabModal();
}

/**
 * 编辑标签
 * @param {string} categoryId - 分类ID
 * @param {string} tabId - 标签ID
 */
function editTab(categoryId, tabId) {
    const category = currentData.categories.find(c => c.id === categoryId);
    if (category) {
        const tab = category.tabs.find(t => t.id === tabId);
        if (tab) {
            openTabModal(tab, categoryId);
        }
    }
}

/**
 * 删除标签
 * @param {string} categoryId - 分类ID
 * @param {string} tabId - 标签ID
 */
function deleteTab(categoryId, tabId) {
    confirmCallback = async () => {
        const category = currentData.categories.find(c => c.id === categoryId);
        if (category) {
            category.tabs = category.tabs.filter(t => t.id !== tabId);
            await saveData();
            renderCategories();
        }
    };
    
    document.getElementById('confirmMessage').textContent = '确定要删除此标签吗？';
    document.getElementById('confirmModal').classList.add('show');
}

/**
 * 打开分类对话框
 * @param {Object} category - 分类对象（编辑时传入）
 */
function openCategoryModal(category = null) {
    currentEditCategory = category;
    const modal = document.getElementById('categoryModal');
    const title = document.getElementById('categoryModalTitle');
    const form = document.getElementById('categoryForm');
    
    // 清空表单
    form.reset();
    
    if (category) {
        title.textContent = '重命名分类';
        document.getElementById('categoryName').value = category.name;
    } else {
        title.textContent = '添加分类';
    }
    
    modal.classList.add('show');
}

/**
 * 关闭分类对话框
 */
function closeCategoryModal() {
    const modal = document.getElementById('categoryModal');
    modal.classList.remove('show');
    currentEditCategory = null;
}

/**
 * 保存分类
 */
async function saveCategory() {
    const name = document.getElementById('categoryName').value.trim();
    
    if (!name) {
        alert('请填写分类名称');
        return;
    }
    
    if (currentEditCategory) {
        // 编辑现有分类
        currentEditCategory.name = name;
    } else {
        // 添加新分类
        const newCategory = {
            id: Date.now().toString(),
            name: name,
            tabs: []
        };
        currentData.categories.push(newCategory);
    }
    
    await saveData();
    renderCategories();
    closeCategoryModal();
}

/**
 * 编辑分类
 * @param {string} categoryId - 分类ID
 */
function editCategory(categoryId) {
    const category = currentData.categories.find(c => c.id === categoryId);
    if (category) {
        openCategoryModal(category);
    }
}

/**
 * 删除分类
 * @param {string} categoryId - 分类ID
 */
function deleteCategory(categoryId) {
    confirmCallback = async () => {
        currentData.categories = currentData.categories.filter(c => c.id !== categoryId);
        await saveData();
        renderCategories();
    };
    
    document.getElementById('confirmMessage').textContent = '确定要删除此分类吗？删除后该分类下的所有标签也会被删除。';
    document.getElementById('confirmModal').classList.add('show');
}

/**
 * 关闭确认对话框
 */
function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    modal.classList.remove('show');
    confirmCallback = null;
}

/**
 * 导入数据
 */
function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    // 验证数据格式
                    if (data.categories && Array.isArray(data.categories)) {
                        currentData = data;
                        await saveData();
                        renderCategories();
                        alert('导入成功');
                    } else {
                        alert('导入失败：数据格式错误');
                    }
                } catch (error) {
                    alert('导入失败：JSON格式错误');
                    console.error('导入失败:', error);
                }
            };
            reader.readAsText(file);
        }
    };
    
    input.click();
}

/**
 * 导出数据
 */
function exportData() {
    const dataStr = JSON.stringify(currentData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tabs.json';
    link.click();
    URL.revokeObjectURL(url);
}

/**
 * 初始化粒子动画
 * 创建星空和烟花效果
 */
function initParticles() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let fireworks = [];
    let particles = [];
    let stars = [];
    let animationId = null;
    
    /**
     * 星星类
     */
    class Star {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height * 0.7;
            this.size = Math.random() * 1.5 + 0.5;
            this.baseAlpha = Math.random() * 0.5 + 0.3;
            this.alpha = this.baseAlpha;
            this.twinkleSpeed = Math.random() * 0.02 + 0.005;
            this.twinkleDirection = 1;
        }
        
        /**
         * 更新星星状态
         */
        update() {
            this.alpha += this.twinkleSpeed * this.twinkleDirection;
            if (this.alpha >= this.baseAlpha + 0.3 || this.alpha <= this.baseAlpha - 0.2) {
                this.twinkleDirection *= -1;
            }
        }
        
        /**
         * 绘制星星
         */
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
            ctx.fill();
        }
    }
    
    /**
     * 创建星星
     */
    function createStars() {
        stars = [];
        const starCount = Math.min(150, Math.floor((canvas.width * canvas.height) / 10000));
        for (let i = 0; i < starCount; i++) {
            stars.push(new Star());
        }
    }
    
    /**
     * 设置canvas尺寸
     */
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        createStars();
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    /**
     * 烟花类
     */
    class Firework {
        constructor(x, y, targetY) {
            this.x = x;
            this.y = y;
            this.targetY = targetY;
            this.speed = 3;
            this.angle = -Math.PI / 2;
            this.velocity = this.speed;
            this.hue = Math.random() * 360;
            this.brightness = Math.random() * 30 + 50;
            this.alpha = 1;
            this.dead = false;
        }
        
        /**
         * 更新烟花状态
         */
        update() {
            this.velocity += 0.05;
            this.x += Math.cos(this.angle) * this.velocity;
            this.y += Math.sin(this.angle) * this.velocity;
            
            if (this.y <= this.targetY) {
                this.dead = true;
                createParticles(this.x, this.y, this.hue);
            }
        }
        
        /**
         * 绘制烟花
         */
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${this.hue}, 100%, ${this.brightness}%, ${this.alpha})`;
            ctx.fill();
            
            // 拖尾效果
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x - Math.cos(this.angle) * 10, this.y - Math.sin(this.angle) * 10);
            ctx.strokeStyle = `hsla(${this.hue}, 100%, ${this.brightness}%, ${this.alpha * 0.5})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
    
    /**
     * 烟花粒子类
     */
    class Particle {
        constructor(x, y, hue) {
            this.x = x;
            this.y = y;
            this.hue = hue;
            this.brightness = Math.random() * 30 + 50;
            this.alpha = 1;
            this.velocity = Math.random() * 5 + 2;
            this.angle = Math.random() * Math.PI * 2;
            this.friction = 0.95;
            this.gravity = 0.1;
            this.decay = Math.random() * 0.02 + 0.01;
        }
        
        /**
         * 更新粒子状态
         */
        update() {
            this.velocity *= this.friction;
            this.x += Math.cos(this.angle) * this.velocity;
            this.y += Math.sin(this.angle) * this.velocity + this.gravity;
            this.alpha -= this.decay;
        }
        
        /**
         * 绘制粒子
         */
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${this.hue}, 100%, ${this.brightness}%, ${this.alpha})`;
            ctx.fill();
        }
    }
    
    /**
     * 创建烟花粒子
     * @param {number} x - X坐标
     * @param {number} y - Y坐标
     * @param {number} hue - 色调
     */
    function createParticles(x, y, hue) {
        const particleCount = 50;
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle(x, y, hue));
        }
    }
    
    /**
     * 创建烟花
     */
    function createFirework() {
        const x = Math.random() * canvas.width;
        const y = canvas.height;
        const targetY = Math.random() * (canvas.height * 0.5) + 50;
        fireworks.push(new Firework(x, y, targetY));
    }
    
    /**
     * 动画循环
     */
    function animate() {
        // 完全清除画布，消除残留
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 绘制星星
        stars.forEach(star => {
            star.update();
            star.draw();
        });
        
        // 随机创建烟花
        if (Math.random() < 0.05) {
            createFirework();
        }
        
        // 更新和绘制烟花
        fireworks = fireworks.filter(firework => {
            firework.update();
            firework.draw();
            return !firework.dead;
        });
        
        // 更新和绘制粒子
        particles = particles.filter(particle => {
            particle.update();
            particle.draw();
            return particle.alpha > 0;
        });
        
        animationId = requestAnimationFrame(animate);
    }
    
    // 初始化
    createStars();
    animate();
    
    // 页面可见性变化时暂停/恢复动画
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            cancelAnimationFrame(animationId);
        } else {
            animate();
        }
    });
}

// 初始化应用
init();