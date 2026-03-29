// 全局变量
let currentData = {
    categories: []
};

let currentEditTab = null;
let currentEditCategory = null;
let confirmCallback = null;

// 初始化
async function init() {
    await loadData();
    renderCategories();
    bindEvents();
}

// 加载数据
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

// 保存数据
async function saveData() {
    try {
        await chrome.storage.local.set({ tabhubData: currentData });
    } catch (error) {
        console.error('保存数据失败:', error);
    }
}

// 渲染分类和标签
function renderCategories() {
    const mainContent = document.getElementById('mainContent');
    const searchInput = document.getElementById('searchInput').value.toLowerCase();
    
    mainContent.innerHTML = '';
    
    if (currentData.categories.length === 0) {
        mainContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📁</div>
                <p>暂无分类，请添加分类</p>
            </div>
        `;
        return;
    }
    
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
                    <button class="btn btn-small btn-outline" onclick="editCategory('${category.id}')">重命名</button>
                    <button class="btn btn-small btn-outline" onclick="deleteCategory('${category.id}')">删除</button>
                </div>
            </div>
            <div class="tabs-container" id="tabs-${category.id}">
                ${filteredTabs.length > 0 ? filteredTabs.map(tab => `
                    <div class="tab-card" onclick="openTab('${tab.url}')">
                        <img class="tab-icon" src="${tab.icon || 'https://www.google.com/favicon.ico'}" alt="${tab.name}">
                        <div class="tab-name">${tab.name}</div>
                        <div class="tab-actions">
                            <button class="btn btn-small btn-outline" onclick="event.stopPropagation(); editTab('${category.id}', '${tab.id}')">编辑</button>
                            <button class="btn btn-small btn-outline" onclick="event.stopPropagation(); deleteTab('${category.id}', '${tab.id}')">删除</button>
                        </div>
                    </div>
                `).join('') : `
                    <div class="empty-state">
                        <p>暂无标签，请添加标签</p>
                    </div>
                `}
            </div>
        `;
        
        mainContent.appendChild(categoryElement);
    });
}

// 绑定事件
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
    
    // 搜索框
    document.getElementById('searchInput').addEventListener('input', renderCategories);
    
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
}

// 打开标签
function openTab(url) {
    window.open(url, '_blank');
}

// 打开标签对话框
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

// 关闭标签对话框
function closeTabModal() {
    const modal = document.getElementById('tabModal');
    modal.classList.remove('show');
    currentEditTab = null;
}

// 保存标签
async function saveTab() {
    const name = document.getElementById('tabName').value;
    const url = document.getElementById('tabUrl').value;
    const icon = document.getElementById('tabIcon').value;
    const categoryId = document.getElementById('tabCategory').value;
    
    if (!name || !url || !categoryId) {
        alert('请填写完整信息');
        return;
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

// 编辑标签
function editTab(categoryId, tabId) {
    const category = currentData.categories.find(c => c.id === categoryId);
    if (category) {
        const tab = category.tabs.find(t => t.id === tabId);
        if (tab) {
            openTabModal(tab, categoryId);
        }
    }
}

// 删除标签
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

// 打开分类对话框
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

// 关闭分类对话框
function closeCategoryModal() {
    const modal = document.getElementById('categoryModal');
    modal.classList.remove('show');
    currentEditCategory = null;
}

// 保存分类
async function saveCategory() {
    const name = document.getElementById('categoryName').value;
    
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

// 编辑分类
function editCategory(categoryId) {
    const category = currentData.categories.find(c => c.id === categoryId);
    if (category) {
        openCategoryModal(category);
    }
}

// 删除分类
function deleteCategory(categoryId) {
    confirmCallback = async () => {
        currentData.categories = currentData.categories.filter(c => c.id !== categoryId);
        await saveData();
        renderCategories();
    };
    
    document.getElementById('confirmMessage').textContent = '确定要删除此分类吗？删除后该分类下的所有标签也会被删除。';
    document.getElementById('confirmModal').classList.add('show');
}

// 关闭确认对话框
function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    modal.classList.remove('show');
    confirmCallback = null;
}

// 导入数据
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
                    currentData = data;
                    await saveData();
                    renderCategories();
                    alert('导入成功');
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

// 导出数据
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

// 初始化应用
init();