class HairShopCatalog {
    constructor() {
        // !! ВОЗВРАЩАЕМСЯ К CORS-ПРОКСИ, НО С ВАШЕЙ ПРЯМОЙ ОПУБЛИКОВАННОЙ ССЫЛКОЙ
        this.CSV_URL = "https://corsproxy.io/?https://docs.google.com/spreadsheets/d/e/2PACX-1vS800Y_zN10Ys9uQfkEB67ZqlWMobbZTAkIu4l4X-a2rp1e80jlrFfhQV1m18n5hHCBANXc7VjRhIo5/pub?output=csv";
        
        this.products = [];
        this.filterRanges = null; // Для хранения мин/макс значений
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
        this.renderLoading(); // Показываем заглушку
        
        // !! ВОЗВРАЩАЕМ СТАРУЮ ЛОГИКУ ЗАГРУЗКИ (fetch)
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
                // Если прокси не сработал
                throw new Error(`HTTP ошибка! Статус: ${response.status}. corsproxy.io мог отказать в доступе.`);
            }
            
            const csvText = await response.text();
            console.log('📄 CSV контент загружен.');
            
            this.products = this.parseCSV(csvText); // Вызываем наш УМНЫЙ парсер CSV
            console.log('✅ Разобрано продуктов:', this.products.length);

            if (this.products.length === 0) {
                 this.renderError('Не удалось разобрать товары из CSV. Проверьте заголовки (id, price, length) и данные в таблице.');
                 return;
            }

            // Настраиваем все остальное
            this.determineFilterRanges();
            this.updateRangeValues();
            this.updateRangeSliders();
            this.renderProducts(this.products);
            this.setupEventListeners(); // Настраиваем обработчики
            
        } catch (error) {
            console.error('❌ Ошибка загрузки или парсинга CSV:', error);
            this.renderError(`Не удалось загрузить данные каталога: ${error.message}.`);
        }
    }

    /**
     * НОВЫЙ УМНЫЙ ПАРСЕР CSV
     * Ищет столбцы по названию заголовка, а не по порядку.
     */
    parseCSV(csvText) {
        const lines = csvText.split('\n');
        if (lines.length < 2) return []; 

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, '')); 
        console.log('Обнаруженные заголовки:', headers);
        const products = [];

        // Находим индексы по заголовкам (ищем русские или английские названия)
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
            this.renderError(`Критическая ошибка: В CSV отсутствуют обязательные заголовки: 'id', 'price' (или 'цена'), 'length' (или 'длина'). Обнаруженные заголовки: [${headers.join(', ')}]`);
            return []; // Возвращаем пустой массив
        }

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Простой парсер CSV (не учитывает запятые внутри кавычек, но для GSheets обычно подходит)
            const values = line.split(','); 
            const product = {};

            // Функция для безопасного получения значения
            const getValue = (index) => (index !== -1 && values[index] !== undefined) ? values[index].trim() : null;

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
    
    //
    // --- (Остальные методы класса не изменились) ---
    //
    
    determineFilterRanges() {
        if (this.products.length === 0) return;

        const allLengths = this.products.map(p => p.length).filter(l => l > 0);
        const allPrices = this.products.map(p => p.price).filter(p => p > 0);
        const allColors = [...new Set(this.products.map(p => p.color))].filter(c => c && c.trim() !== ''); // Добавлена проверка на пустые строки

        this.filterRanges = {
            length: {
                min: Math.min(...allLengths) || 14,
                max: Math.max(...allLengths) || 30
            },
            price: {
                min: Math.min(...allPrices) || 1000,
                max: Math.max(...allPrices) || 10000
            },
            colors: allColors.sort()
        };
        
        this.filters.minLength = this.filterRanges.length.min;
        this.filters.maxLength = this.filterRanges.length.max;
        this.filters.minPrice = this.filterRanges.price.min;
        this.filters.maxPrice = this.filterRanges.price.max;
        
        this.setupColorFilter(allColors);
    }
    
    setupColorFilter(colors) {
        const select = document.getElementById('colorFilter');
        if (!select) return;
        select.innerHTML = '';
        
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
                    Загрузка каталога... 💇‍♀️
                </div>
            `;
        }
    }
    
    renderError(message) {
        const container = document.getElementById('productsContainer');
        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    <h2>Проблема с загрузкой</h2>
                    <p>${message}</p>
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
                    <h2>Ничего не найдено 😔</h2>
                    <p>Попробуйте сбросить или изменить фильтры.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = products.map(product => `
            <div class="product-card">
                <img src="${product.imageUrl || 'https://placehold.co/400x200/cccccc/333333?text=Нет+фото'}" 
                     alt="${product.name}" 
                     class="product-image"
                     onerror="this.onerror=null;this.src='https://placehold.co/400x200/cccccc/333333?text=Нет+фото';">
                <div class="product-info">
                    <h3 class="product-name">${product.name}</h3>
                    <p class.product-description>${product.description}</p>
                    <p class="product-details">
                        📏 Длина: ${product.length} см | 🎨 Цвет: ${product.color}
                    </p>
                    <div class="price-section">
                        <span class="product-price">${product.price.toLocaleString('ru-RU')} ₽</span>
                        ${product.oldPrice > 0 && product.oldPrice > product.price ? `<span class="product-old-price">${product.oldPrice.toLocaleString('ru-RU')} ₽</span>` : ''}
                    </div>
                    <button class="add-to-cart-button" onclick="window.catalog.addToCart(${product.id})">
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

        if(this.filterRanges) {
            if (lengthMinSlider) {
                lengthMinSlider.min = this.filterRanges.length.min;
                lengthMinSlider.max = this.filterRanges.length.max;
                lengthMinSlider.value = this.filters.minLength;
            }
            if (lengthMaxSlider) {
                lengthMaxSlider.min = this.filterRanges.length.min;
                lengthMaxSlider.max = this.filterRanges.length.max;
                lengthMaxSlider.value = this.filters.maxLength;
            }
            if (priceMinSlider) {
                priceMinSlider.min = this.filterRanges.price.min;
                priceMinSlider.max = this.filterRanges.price.max;
                priceMinSlider.value = this.filters.minPrice;
            }
            if (priceMaxSlider) {
                priceMaxSlider.min = this.filterRanges.price.min;
                priceMaxSlider.max = this.filterRanges.price.max;
                priceMaxSlider.value = this.filters.maxPrice;
            }
        }

        [lengthMinSlider, lengthMaxSlider, priceMinSlider, priceMaxSlider].forEach(slider => {
            if (slider) slider.addEventListener('input', (e) => this.handleSliderInput(e.target));
        });

        if (colorFilter) colorFilter.addEventListener('change', this.handleColorFilterChange.bind(this));
        if (resetButton) resetButton.addEventListener('click', this.resetFilters.bind(this));
    }
    
    handleColorFilterChange(event) {
        const selectedOptions = Array.from(event.target.selectedOptions).map(option => option.value);
        this.filters.colors = selectedOptions;
        this.applyFilters();
    }

    updateRangeValues() {
        const lengthMin = document.getElementById('lengthMin') ? parseInt(document.getElementById('lengthMin').value) : this.filters.minLength;
        const lengthMax = document.getElementById('lengthMax') ? parseInt(document.getElementById('lengthMax').value) : this.filters.maxLength;
        const priceMin = document.getElementById('priceMin') ? parseInt(document.getElementById('priceMin').value) : this.filters.minPrice;
        const priceMax = document.getElementById('priceMax') ? parseInt(document.getElementById('priceMax').value) : this.filters.maxPrice;

        this.filters.minLength = lengthMin;
        this.filters.maxLength = lengthMax;
        this.filters.minPrice = priceMin;
        this.filters.maxPrice = priceMax;

        const lengthValueSpan = document.getElementById('lengthValue');
        if (lengthValueSpan) lengthValueSpan.textContent = `${lengthMin}-${lengthMax} см`;
        
        const priceValueSpan = document.getElementById('priceValue');
        if (priceValueSpan) priceValueSpan.textContent = `${priceMin.toLocaleString('ru-RU')}-${priceMax.toLocaleString('ru-RU')} ₽`;
    }
    
    updateRangeSliders() {
        const lengthMinSlider = document.getElementById('lengthMin');
        const lengthMaxSlider = document.getElementById('lengthMax');
        const priceMinSlider = document.getElementById('priceMin');
        const priceMaxSlider = document.getElementById('priceMax');
        
        if (lengthMinSlider) lengthMinSlider.value = this.filters.minLength;
        if (lengthMaxSlider) lengthMaxSlider.value = this.filters.maxLength;
        if (priceMinSlider) priceMinSlider.value = this.filters.minPrice;
        if (priceMaxSlider) priceMaxSlider.value = this.filters.maxPrice;
        
        this.updateRangeValues();
    }

    handleSliderInput(slider) {
        const currentId = slider.id;
        let value = parseInt(slider.value);
        
        if (currentId === 'lengthMin' && value > this.filters.maxLength) {
            value = this.filters.maxLength;
            slider.value = value;
        } else if (currentId === 'lengthMax' && value < this.filters.minLength) {
            value = this.filters.minLength;
            slider.value = value;
        }
        
        if (currentId === 'priceMin' && value > this.filters.maxPrice) {
            value = this.filters.maxPrice;
            slider.value = value;
        } else if (currentId === 'priceMax' && value < this.filters.minPrice) {
            value = this.filters.minPrice;
            slider.value = value;
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
            
            const colorMatch = this.filters.colors.length === 0 || 
                             this.filters.colors.includes(product.color);
            
            return lengthMatch && priceMatch && colorMatch;
        });
        
        this.renderProducts(filteredProducts);
    }

    resetFilters() {
        if (this.filterRanges) {
            this.filters = {
                minLength: this.filterRanges.length.min,
                maxLength: this.filterRanges.length.max,
                minPrice: this.filterRanges.price.min,
                maxPrice: this.filterRanges.price.max,
                colors: []
            };
            
            const colorSelect = document.getElementById('colorFilter');
            if(colorSelect) {
                 Array.from(colorSelect.options).forEach(option => option.selected = false);
            }
            
            this.updateRangeSliders();
            this.applyFilters();
        }
    }

    addToCart(productId) {
        // В Mini App здесь будет интеграция с Telegram.WebApp
        console.log(`Товар #${productId} добавлен в корзину!`);
    }
}