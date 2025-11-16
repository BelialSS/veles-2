class HairShopCatalog {
    constructor() {
        // !! ИСПОЛЬЗУЕМ CORS-ПРОКСИ С ПРЯМОЙ ОПУБЛИКОВАННОЙ CSV-ССЫЛКОЙ
        this.CSV_URL = "https://corsproxy.io/?https://docs.google.com/spreadsheets/d/e/2PACX-1vS800Y_zN10Ys9uQfkEB67ZqlWMobbZTAkIu4l4X-a2rp1e80jlrFfhQV1m18n5hHCBANXc7VjRhIo5/pub?output=csv";
        
        this.products = [];
        this.filterRanges = null; 
        this.filters = {
            minLength: 14,
            maxLength: 30,
            minPrice: 1000,
            maxPrice: 10000,
            colors: []
        };
        
        this.init();
    }

    async init() {
        this.renderLoading(); 
        await this.loadProductsFromCSV();
    }

    /**
     * Загружает данные с помощью fetch и CORS-прокси
     */
    async loadProductsFromCSV() {
        try {
            console.log('📥 Загрузка из (CORS Proxy):', this.CSV_URL);
            const response = await fetch(this.CSV_URL);
            
            if (!response.ok) {
                throw new Error(`HTTP ошибка! Статус: ${response.status}. Возможно, corsproxy.io заблокирован или ссылка неверна.`);
            }
            
            const csvText = await response.text();
            console.log('📄 CSV контент загружен.');
            
            this.products = this.parseCSV(csvText); 
            console.log('✅ Разобрано продуктов:', this.products.length);

            if (this.products.length === 0) {
                 this.renderError('Не удалось разобрать товары из CSV. Проверьте заголовки (id, price, length, color и т.д.) и данные в таблице.');
                 return;
            }

            // Настраиваем все элементы UI
            this.determineFilterRanges();
            this.updateRangeValues();
            this.updateRangeSliders();
            this.renderProducts(this.products);
            this.setupEventListeners(); 
            
        } catch (error) {
            console.error('❌ Ошибка загрузки или парсинга CSV:', error);
            this.renderError(`Не удалось загрузить данные каталога: ${error.message}. Пожалуйста, проверьте консоль (F12) для деталей.`);
        }
    }

    /**
     * УМНЫЙ ПАРСЕР CSV
     * Ищет столбцы по названию заголовка (русскому или английскому), а не по порядку.
     */
    parseCSV(csvText) {
        // Удаляем пустые строки и строки с лишними пробелами
        const lines = csvText.split('\n').filter(line => line.trim() !== ''); 
        if (lines.length < 2) return []; 

        // Парсинг заголовков (очищаем от кавычек, лишних пробелов и переводим в нижний регистр)
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, '')); 
        console.log('Обнаруженные заголовки:', headers);
        const products = [];

        // Находим индексы по заголовкам (проверка на русские/английские варианты)
        const colIndices = {
            id: headers.indexOf('id'),
            name: headers.indexOf('name') > -1 ? headers.indexOf('name') : headers.indexOf('название'),
            length: headers.indexOf('length') > -1 ? headers.indexOf('length') : headers.indexOf('длина'),
            price: headers.indexOf('price') > -1 ? headers.indexOf('price') : headers.indexOf('цена'),
            oldPrice: headers.indexOf('old_price') > -1 ? headers.indexOf('old_price') : headers.indexOf('стараяцена'),
            color: headers.indexOf('color') > -1 ? headers.indexOf('color') : headers.indexOf('цвет'),
            imageUrl: headers.indexOf('images') > -1 ? headers.indexOf('images') : headers.indexOf('imageurl'),
            description: headers.indexOf('description') > -1 ? headers.indexOf('description') : headers.indexOf('описание'),
        };
        
        // Проверка, найдены ли ключевые столбцы
        if (colIndices.id === -1 || colIndices.price === -1 || colIndices.length === -1) {
            console.error(`Критическая ошибка: В CSV отсутствуют обязательные заголовки: 'id', 'price' (или 'цена'), 'length' (или 'длина'). Обнаруженные заголовки: [${headers.join(', ')}]`);
            return []; 
        }

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = line.split(','); 
            const product = {};

            // Функция для безопасного получения значения и удаления кавычек
            const getValue = (index) => (index !== -1 && values[index] !== undefined) ? values[index].trim().replace(/"/g, '') : null;

            product.id = getValue(colIndices.id);
            product.name = getValue(colIndices.name) || 'Без названия';
            product.length = parseInt(getValue(colIndices.length)) || 0;
            product.price = parseInt(getValue(colIndices.price)) || 0;
            product.oldPrice = parseInt(getValue(colIndices.oldPrice)) || 0;
            product.color = getValue(colIndices.color) || 'Неизвестный';
            product.imageUrl = getValue(colIndices.imageUrl) || '';
            product.description = getValue(colIndices.description) || 'Нет описания.';

            if (product.id && product.price > 0 && product.length > 0) {
                products.push(product);
            }
        }
        return products;
    }
    
    determineFilterRanges() {
        if (this.products.length === 0) return;

        const allLengths = this.products.map(p => p.length).filter(l => l > 0);
        const allPrices = this.products.map(p => p.price).filter(p => p > 0);
        // Создаем массив уникальных цветов, исключая пустые/неизвестные
        const allColors = [...new Set(this.products.map(p => p.color))].filter(c => c && c.trim() !== '' && c !== 'Неизвестный'); 

        const minLength = Math.min(...allLengths);
        const maxLength = Math.max(...allLengths);
        const minPrice = Math.min(...allPrices);
        const maxPrice = Math.max(...allPrices);

        this.filterRanges = {
            length: { min: minLength, max: maxLength },
            price: { min: minPrice, max: maxPrice },
            colors: allColors.sort()
        };
        
        // Устанавливаем текущие фильтры в границы диапазона
        this.filters.minLength = minLength;
        this.filters.maxLength = maxLength;
        this.filters.minPrice = minPrice;
        this.filters.maxPrice = maxPrice;
        
        this.setupColorFilter(allColors);
    }
    
    setupColorFilter(colors) {
        const select = document.getElementById('colorFilter');
        if (!select) return;
        select.innerHTML = '';
        
        // Создаем опцию для сброса фильтра, которая не будет добавляться в this.filters.colors
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '— Выберите цвет(а) —';
        select.appendChild(defaultOption);

        colors.forEach(color => {
            const option = document.createElement('option');
            option.value = color;
            option.textContent = color;
            select.appendChild(option);
        });
    }

    renderLoading() {
        const container = document.getElementById('productsContainer');
        if (container) {
            container.innerHTML = `
                <div id="loadingIndicator" class="loading-indicator">
                    <h2>Загрузка каталога... 💇‍♀️</h2>
                    <div class="spinner"></div>
                    <p>Пожалуйста, подождите, идет загрузка данных из Google Таблицы.</p>
                </div>
            `;
        }
    }
    
    renderError(message) {
        const container = document.getElementById('productsContainer');
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }

        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    <h3>❌ Ошибка загрузки данных</h3>
                    <p>${message}</p>
                    <p>Проверьте, что таблица опубликована в формат CSV и адрес верен.</p>
                </div>
            `;
        }
    }

    renderProducts(products) {
        const container = document.getElementById('productsContainer');
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
        
        if (!container) return;

        if (products.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <h3>Нет товаров по заданным фильтрам 😔</h3>
                    <p>Попробуйте сбросить фильтры.</p>
                    <button class="reset-button" onclick="window.catalog.resetFilters()">Сбросить фильтры</button>
                </div>
            `;
            return;
        }

        container.innerHTML = products.map(product => `
            <div class="product-card">
                <img src="${product.imageUrl || 'https://placehold.co/400x200/cccccc/333333?text=Нет+Фото'}" 
                     alt="${product.name}" class="product-image" onerror="this.onerror=null;this.src='https://placehold.co/400x200/cccccc/333333?text=Нет+Фото';">
                <div class="product-info">
                    <h4 class="product-name">${product.name}</h4>
                    <p class="product-description">${product.description.substring(0, 100)}...</p>
                    <div class="product-specs">
                        <span>📏 ${product.length} см</span>
                        <span>🎨 ${product.color}</span>
                    </div>
                    <div class="price-section">
                        ${product.oldPrice > product.price ? 
                            `<span class="product-old-price">${product.oldPrice.toLocaleString('ru-RU')} ₽</span>` : ''}
                        <span class="product-price">${product.price.toLocaleString('ru-RU')} ₽</span>
                    </div>
                    <button class="add-to-cart-button" onclick="window.catalog.addToCart('${product.id}')">
                        🛍️ Добавить в корзину
                    </button>
                </div>
            </div>
        `).join('');
    }

    setupEventListeners() {
        const lengthMinSlider = document.getElementById('lengthMin');
        const lengthMaxSlider = document.getElementById('lengthMax');
        const priceMinSlider = document.getElementById('priceMin');
        const priceMaxSlider = document.getElementById('priceMax');
        const colorFilter = document.getElementById('colorFilter');
        const resetButton = document.getElementById('resetFilters');

        // Устанавливаем min/max значения для ползунков на основе реальных данных
        if(this.filterRanges) {
            if (lengthMinSlider) {
                lengthMinSlider.min = this.filterRanges.length.min;
                lengthMinSlider.max = this.filterRanges.length.max;
            }
            if (lengthMaxSlider) {
                lengthMaxSlider.min = this.filterRanges.length.min;
                lengthMaxSlider.max = this.filterRanges.length.max;
            }
            if (priceMinSlider) {
                priceMinSlider.min = this.filterRanges.price.min;
                priceMinSlider.max = this.filterRanges.price.max;
            }
            if (priceMaxSlider) {
                priceMaxSlider.min = this.filterRanges.price.min;
                priceMaxSlider.max = this.filterRanges.price.max;
            }
        }

        // Слушатели событий для ползунков
        [lengthMinSlider, lengthMaxSlider, priceMinSlider, priceMaxSlider].forEach(slider => {
            if (slider) slider.addEventListener('input', (e) => this.handleSliderInput(e.target));
        });

        // Слушатель для фильтра по цвету
        if (colorFilter) colorFilter.addEventListener('change', this.handleColorFilterChange.bind(this));
        // Слушатель для кнопки сброса
        if (resetButton) resetButton.addEventListener('click', this.resetFilters.bind(this));
    }
    
    handleColorFilterChange(event) {
        // Получаем все выбранные опции и фильтруем пустые значения (опция "— Выберите цвет(а) —")
        this.filters.colors = Array.from(event.target.selectedOptions)
                                 .map(option => option.value)
                                 .filter(value => value !== ''); 
        this.applyFilters();
    }

    updateRangeValues() {
        const lengthMin = this.filters.minLength;
        const lengthMax = this.filters.maxLength;
        const priceMin = this.filters.minPrice;
        const priceMax = this.filters.maxPrice;

        const lengthValueSpan = document.getElementById('lengthValue');
        const priceValueSpan = document.getElementById('priceValue');
        
        if (lengthValueSpan) lengthValueSpan.textContent = `${lengthMin}-${lengthMax} см`;
        // Используем форматирование для валюты
        if (priceValueSpan) priceValueSpan.textContent = `${priceMin.toLocaleString('ru-RU')}-${priceMax.toLocaleString('ru-RU')} ₽`;
    }
    
    updateRangeSliders() {
        const lengthMinSlider = document.getElementById('lengthMin');
        const lengthMaxSlider = document.getElementById('lengthMax');
        const priceMinSlider = document.getElementById('priceMin');
        const priceMaxSlider = document.getElementById('priceMax');

        // Обновляем позицию ползунков
        if (lengthMinSlider) lengthMinSlider.value = this.filters.minLength;
        if (lengthMaxSlider) lengthMaxSlider.value = this.filters.maxLength;
        if (priceMinSlider) priceMinSlider.value = this.filters.minPrice;
        if (priceMaxSlider) priceMaxSlider.value = this.filters.maxPrice;
        
        this.updateRangeValues();
    }
    
    handleSliderInput(slider) {
        const currentId = slider.id;
        let value = parseInt(slider.value);

        if (currentId === 'lengthMin') {
            if (value > this.filters.maxLength) value = this.filters.maxLength;
            this.filters.minLength = value;
        } else if (currentId === 'lengthMax') {
            if (value < this.filters.minLength) value = this.filters.minLength;
            this.filters.maxLength = value;
        } else if (currentId === 'priceMin') {
            if (value > this.filters.maxPrice) value = this.filters.maxPrice;
            this.filters.minPrice = value;
        } else if (currentId === 'priceMax') {
            if (value < this.filters.minPrice) value = this.filters.minPrice;
            this.filters.maxPrice = value;
        }
        
        this.updateRangeValues();
        this.applyFilters();
    }

    applyFilters() {
        const filteredProducts = this.products.filter(product => {
            const lengthMatch = product.length >= this.filters.minLength && 
                              product.length <= this.filters.maxLength;
            
            const priceMatch = product.price >= this.filters.minPrice && 
                             product.price <= this.filters.maxPrice;
            
            // Если массив цветов пуст (нет выбранных фильтров), то цвет подходит (true)
            const colorMatch = this.filters.colors.length === 0 || 
                             this.filters.colors.includes(product.color);
            
            return lengthMatch && priceMatch && colorMatch;
        });
        
        this.renderProducts(filteredProducts);
    }

    resetFilters() {
        if (this.filterRanges) {
            // Восстанавливаем фильтры до исходных границ диапазона
            this.filters = {
                minLength: this.filterRanges.length.min,
                maxLength: this.filterRanges.length.max,
                minPrice: this.filterRanges.price.min,
                maxPrice: this.filterRanges.price.max,
                colors: [] // Сбрасываем выбранные цвета
            };
            
            const colorFilter = document.getElementById('colorFilter');
            // Сброс выбранных опций в UI
            if(colorFilter) Array.from(colorFilter.options).forEach(option => option.selected = false);
            
            this.updateRangeSliders();
            this.applyFilters();
        }
    }

    addToCart(productId) {
        // Используем console.log вместо alert
        console.log(`Товар #${productId} добавлен в корзину!`);
    }
}

// Запускаем каталог при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    window.catalog = new HairShopCatalog();
});