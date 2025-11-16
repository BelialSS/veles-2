class HairShopCatalog {
    constructor() {
        // !!! ВАЖНО: ЗАМЕНИТЕ ЭТУ ССЫЛКУ НА ВАШУ ОПУБЛИКОВАННУЮ CSV-ССЫЛКУ ИЗ GOOGLE ТАБЛИЦЫ
        // Пример (замените на свою): "https://docs.google.com/spreadsheets/d/e/2PACX-1vS800Y_zN10Ys9uQfkEB67ZqlWMobbZTAkIu4l4X-a2rp1e80jlrFfhQV1m18n5hHCBANXc7VjRhIo5/pub?output=csv"
        // Используем CORS прокси для обхода блокировки запросов между разными доменами
        this.CSV_URL = "https://corsproxy.io/?https://docs.google.com/spreadsheets/d/e/2PACX-1vS800Y_zN10Ys9uQfkEB67ZqlWMobbZTAkIu4l4X-a2rp1e80jlrFfhQV1m18n5hHCBANXc7VjRhIo5/pub?output=csv";
        
        this.products = [];
        this.filterRanges = null; // Для хранения мин/макс значений из CSV
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
        this.renderLoading(); // Показываем заглушку сразу
        await this.loadProductsFromCSV(); // Загружаем данные
        this.setupEventListeners(); // Настраиваем обработчики событий
    }

    async loadProductsFromCSV() {
        try {
            console.log('📥 Loading from:', this.CSV_URL);
            const response = await fetch(this.CSV_URL);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const csvText = await response.text();
            console.log('📄 CSV content loaded.');
            
            this.products = this.parseCSV(csvText);
            console.log('✅ Parsed products:', this.products.length);

            // Определяем начальные диапазоны фильтров на основе загруженных данных
            this.determineFilterRanges();
            
            // Применяем начальные фильтры и отрисовываем
            this.updateRangeValues();
            this.updateRangeSliders();
            this.renderProducts(this.products);
            
        } catch (error) {
            console.error('❌ Ошибка загрузки или парсинга CSV:', error);
            this.renderError('Не удалось загрузить данные каталога. Проверьте соединение, ссылку на CSV и консоль браузера.');
        }
    }

    parseCSV(csvText) {
        const lines = csvText.split('\n');
        if (lines.length < 2) return []; // Меньше двух строк (заголовок + данные)

        // Предполагаем, что первая строка - заголовок
        // headers = ['ID', 'Название', 'Длина', 'Цена', 'СтараяЦена', 'Цвет', 'СсылкаНаИзображение', 'Описание']
        const headers = lines[0].split(',').map(h => h.trim()); 
        const products = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = line.split(','); // Разделяем по запятой
            const product = {};

            // Предполагаемый порядок столбцов в CSV
            product.id = parseInt(values[0]?.trim()) || 0;
            product.name = values[1]?.trim() || 'Без названия';
            product.length = parseInt(values[2]?.trim()) || 0;
            product.price = parseInt(values[3]?.trim()) || 0;
            product.oldPrice = parseInt(values[4]?.trim()) || 0;
            product.color = values[5]?.trim() || 'Неизвестный';
            product.imageUrl = values[6]?.trim() || '';
            product.description = values[7]?.trim() || 'Нет описания.';

            // Добавляем только валидные товары
            if (product.id > 0 && product.price > 0 && product.length > 0) {
                products.push(product);
            }
        }
        return products;
    }
    
    // Определяет минимальные и максимальные значения для фильтров из загруженных товаров
    determineFilterRanges() {
        if (this.products.length === 0) return;

        const allLengths = this.products.map(p => p.length).filter(l => l > 0);
        const allPrices = this.products.map(p => p.price).filter(p => p > 0);
        const allColors = [...new Set(this.products.map(p => p.color))].filter(c => c);

        this.filterRanges = {
            length: {
                min: Math.min(...allLengths) || 14,
                max: Math.max(...allLengths) || 30
            },
            price: {
                min: Math.min(...allPrices) || 1000,
                max: Math.max(...allPrices) || 10000
            },
            colors: allColors.sort() // Сортируем цвета для удобства
        };
        
        // Устанавливаем начальные фильтры в найденные диапазоны
        this.filters.minLength = this.filterRanges.length.min;
        this.filters.maxLength = this.filterRanges.length.max;
        this.filters.minPrice = this.filterRanges.price.min;
        this.filters.maxPrice = this.filterRanges.price.max;
        
        this.setupColorFilter(allColors);
    }
    
    // Заполняет выпадающий список цветов
    setupColorFilter(colors) {
        const select = document.getElementById('colorFilter');
        if (!select) return;
        select.innerHTML = ''; // Очистка
        
        colors.forEach(color => {
            const option = document.createElement('option');
            option.value = color;
            option.textContent = color;
            select.appendChild(option);
        });
    }

    // Отображает индикатор загрузки
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
    
    // Отображает сообщение об ошибке
    renderError(message) {
        const container = document.getElementById('productsContainer');
        if (container) {
            container.innerHTML = `
                <div class="error-message">
                    <h2>Проблема с загрузкой</h2>
                    <p>${message}</p>
                    <p>Проверьте консоль для получения подробной информации.</p>
                </div>
            `;
        }
    }

    // Рендерит карточки товаров
    renderProducts(products) {
        const container = document.getElementById('productsContainer');
        const loadingIndicator = document.getElementById('loadingIndicator');

        if (loadingIndicator) {
            loadingIndicator.remove(); // Удаляем индикатор загрузки, если он есть
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
                    <p class="product-description">${product.description}</p>
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

    // Настраивает слушатели событий для элементов управления
    setupEventListeners() {
        const lengthMinSlider = document.getElementById('lengthMin');
        const lengthMaxSlider = document.getElementById('lengthMax');
        const priceMinSlider = document.getElementById('priceMin');
        const priceMaxSlider = document.getElementById('priceMax');
        const colorFilter = document.getElementById('colorFilter');
        const resetButton = document.getElementById('resetFilters');

        if(this.filterRanges) {
            // Устанавливаем атрибуты min/max для ползунков на основе реальных данных
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
            if (slider) slider.addEventListener('input', this.handleSliderInput.bind(this, slider));
        });

        if (colorFilter) colorFilter.addEventListener('change', this.handleColorFilterChange.bind(this));
        if (resetButton) resetButton.addEventListener('click', this.resetFilters.bind(this));
    }
    
    // Обрабатывает изменение выбранных цветов
    handleColorFilterChange(event) {
        const selectedOptions = Array.from(event.target.selectedOptions).map(option => option.value);
        this.filters.colors = selectedOptions;
        this.applyFilters();
    }

    // Обновляет отображаемые значения ползунков
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
    
    // Обновляет позицию ползунков
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

    // Обрабатывает ввод в ползунок
    handleSliderInput(slider) {
        const currentId = slider.id;
        let value = parseInt(slider.value);
        
        // Логика для ползунка длины (предотвращение инверсии)
        if (currentId === 'lengthMin' && value > this.filters.maxLength) {
            value = this.filters.maxLength;
            slider.value = value;
        } else if (currentId === 'lengthMax' && value < this.filters.minLength) {
            value = this.filters.minLength;
            slider.value = value;
        }
        
        // Логика для ползунка цены (предотвращение инверсии)
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

    // Применяет все активные фильтры к продуктам
    applyFilters() {
        const filteredProducts = this.products.filter(product => {
            const lengthMatch = product.length >= this.filters.minLength && 
                              product.length <= this.filters.maxLength;
            
            const priceMatch = product.price >= this.filters.minPrice && 
                             product.price <= this.filters.maxPrice;
            
            // Если массив цветов пуст, совпадение по цвету = true (то есть, все цвета подходят)
            const colorMatch = this.filters.colors.length === 0 || 
                             this.filters.colors.includes(product.color);
            
            return lengthMatch && priceMatch && colorMatch;
        });
        
        this.renderProducts(filteredProducts);
    }

    // Сбрасывает все фильтры к их начальным значениям
    resetFilters() {
        if (this.filterRanges) {
            this.filters = {
                minLength: this.filterRanges.length.min,
                maxLength: this.filterRanges.length.max,
                minPrice: this.filterRanges.price.min,
                maxPrice: this.filterRanges.price.max,
                colors: []
            };
            
            // Сбрасываем выбранные опции в select
            const colorSelect = document.getElementById('colorFilter');
            if(colorSelect) {
                 Array.from(colorSelect.options).forEach(option => option.selected = false);
            }
            
            this.updateRangeSliders(); // Обновляем ползунки и их значения
            this.applyFilters(); // Повторно применяем фильтры (отображаем все товары)
        }
    }

    /**
     * @description Функция для добавления товара в корзину.
     * В реальном Mini App здесь будет интеграция с Telegram.WebApp.
     */
    addToCart(productId) {
        // Здесь можно добавить логику для работы с Telegram.WebApp, например:
        // Telegram.WebApp.showAlert(`Товар #${productId} добавлен в корзину!`);
        console.log(`Товар #${productId} добавлен в корзину! (В будущем здесь будет логика Telegram Mini App)`);
        // Или можно обновить UI, чтобы показать, что товар в корзине
    }
}

// Запускаем каталог после полной загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    window.catalog = new HairShopCatalog();
});