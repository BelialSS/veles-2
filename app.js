/**
 * Класс HairShopCatalog управляет загрузкой данных, фильтрацией и отображением товаров.
 */
class HairShopCatalog {
    constructor() {
        // РЕКОМЕНДАЦИЯ: Используем прямую ссылку на CSV-экспорт для опубликованной таблицы.
        // ЭТО РАБОТАЕТ, ТОЛЬКО ЕСЛИ ТАБЛИЦА "15KZ6DHJD4zin2nATxLG-xBGx-BClYWUDAY_mW0VIwoM"
        // ПУБЛИЧНО ДОСТУПНА (Файл -> Поделиться -> Опубликовать в Интернете)
        this.CSV_URL = "https://docs.google.com/spreadsheets/d/15KZ6DHJD4zin2nATxLG-xBGx-BClYWUDAY_mW0VIwoM/export?format=csv&gid=0";
        
        this.products = [];
        this.filterRanges = null; // Для хранения минимальных/максимальных значений
        this.filters = {
            minLength: 14,
            maxLength: 30,
            minPrice: 1000,
            maxPrice: 10000,
            colors: []
        };
        
        this.init();
    }

    /**
     * Инициализация приложения: показывает загрузку, загружает данные и настраивает события.
     */
    async init() {
        this.renderLoading();
        await this.loadProductsFromCSV();
        this.setupEventListeners();
    }

    /**
     * Загрузка и парсинг данных из Google Таблицы в формате CSV.
     */
    async loadProductsFromCSV() {
        try {
            console.log('📥 Загрузка данных из:', this.CSV_URL);
            
            const response = await fetch(this.CSV_URL);
            
            if (!response.ok) {
                throw new Error(`Ошибка HTTP! Статус: ${response.status}. Проверьте доступ к CSV-файлу.`);
            }
            
            const csvText = await response.text();
            this.products = this.parseCSV(csvText);
            
            if (this.products.length === 0) {
                 this.renderError('Не удалось загрузить или разобрать товары. Проверьте структуру CSV и заголовки.');
                 return;
            }
            
            this.initializeFilters();
            this.applyFilters();
            console.log('✅ Данные успешно загружены и готовы к отображению.');

        } catch (error) {
            console.error('❌ Ошибка при загрузке каталога:', error);
            this.renderError(`Ошибка загрузки данных: ${error.message}`);
        }
    }

    /**
     * Парсинг CSV-строки в массив объектов.
     * Ожидаемые заголовки: id, name, length, price, oldPrice, color, imageUrl
     */
    parseCSV(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const products = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length === headers.length) {
                const product = {};
                headers.forEach((header, index) => {
                    // Используем .trim() для удаления лишних пробелов
                    const value = values[index].trim();
                    
                    if (header === 'id') {
                        product[header] = value;
                    } else if (header === 'length' || header === 'price' || header === 'oldPrice') {
                        // Преобразуем числовые поля, убирая все, кроме цифр
                        product[header] = parseInt(value.replace(/[^\d]/g, ''), 10) || 0;
                    } else {
                        product[header] = value;
                    }
                });
                products.push(product);
            }
        }
        return products;
    }
    
    /**
     * Парсинг строки CSV с учетом кавычек.
     */
    parseCSVLine(line) {
        const values = [];
        let inQuotes = false;
        let currentField = '';

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                // Обработка экранированных кавычек ("" -> ")
                if (inQuotes && line[i + 1] === '"') {
                    currentField += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                values.push(currentField);
                currentField = '';
            } else {
                currentField += char;
            }
        }
        values.push(currentField); // Добавляем последнее поле
        return values;
    }


    /**
     * Определяет начальные (минимальные и максимальные) диапазоны фильтров.
     */
    initializeFilters() {
        if (this.products.length === 0) return;

        const allLengths = this.products.map(p => p.length);
        const allPrices = this.products.map(p => p.price);

        const minLength = Math.min(...allLengths);
        const maxLength = Math.max(...allLengths);
        const minPrice = Math.min(...allPrices);
        const maxPrice = Math.max(...allPrices);

        this.filterRanges = {
            length: { min: minLength, max: maxLength },
            price: { min: minPrice, max: maxPrice }
        };

        // Устанавливаем текущие фильтры по начальным диапазонам
        this.filters = {
            minLength: minLength,
            maxLength: maxLength,
            minPrice: minPrice,
            maxPrice: maxPrice,
            colors: []
        };
        
        this.updateRangeSliders();
        this.updateRangeLabels();
    }

    /**
     * Настраивает ползунки на основе текущих значений фильтров.
     */
    updateRangeSliders() {
        const { length, price } = this.filterRanges;

        // Длина
        const lengthMinInput = document.getElementById('lengthMin');
        const lengthMaxInput = document.getElementById('lengthMax');
        
        if (lengthMinInput && lengthMaxInput) {
             lengthMinInput.min = length.min;
             lengthMinInput.max = length.max;
             lengthMinInput.value = this.filters.minLength;
             
             lengthMaxInput.min = length.min;
             lengthMaxInput.max = length.max;
             lengthMaxInput.value = this.filters.maxLength;
        }

        // Цена
        const priceMinInput = document.getElementById('priceMin');
        const priceMaxInput = document.getElementById('priceMax');
        
        if (priceMinInput && priceMaxInput) {
             priceMinInput.min = price.min;
             priceMinInput.max = price.max;
             priceMinInput.value = this.filters.minPrice;
             
             priceMaxInput.min = price.min;
             priceMaxInput.max = price.max;
             priceMaxInput.value = this.filters.maxPrice;
        }
        
        // Сбрасываем селект цвета
        const colorSelect = document.getElementById('colorFilter');
        if (colorSelect) {
            Array.from(colorSelect.options).forEach(option => {
                option.selected = false;
            });
        }
    }
    
    /**
     * Обновляет текстовые подписи над ползунками.
     */
    updateRangeLabels() {
        const lengthValueSpan = document.getElementById('lengthValue');
        if (lengthValueSpan) {
            lengthValueSpan.textContent = `${this.filters.minLength}-${this.filters.maxLength} см`;
        }
        
        const priceValueSpan = document.getElementById('priceValue');
        if (priceValueSpan) {
            priceValueSpan.textContent = `${this.filters.minPrice}-${this.filters.maxPrice} ₽`;
        }
    }


    /**
     * Рендеринг всех карточек товаров.
     */
    renderProducts(products) {
        const container = document.getElementById('productsContainer');
        if (!container) {
            console.error('❌ Контейнер "productsContainer" не найден в DOM.');
            return;
        }

        if (products.length === 0) {
            container.innerHTML = `<p class="no-results">По вашим фильтрам ничего не найдено. Попробуйте сбросить фильтры.</p>`;
            return;
        }

        container.innerHTML = products.map(product => this.createProductCard(product)).join('');

        // Добавляем обработчики кнопок после рендеринга
        container.querySelectorAll('.add-to-cart').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.currentTarget.dataset.id;
                this.addToCart(productId);
            });
        });
    }

    /**
     * Создает HTML-разметку для одной карточки товара.
     */
createProductCard(product) {
        // Проверяем, есть ли старая цена для отображения скидки
        const hasDiscount = product.oldPrice && product.oldPrice > product.price;
        const priceDisplay = hasDiscount 
            ? `<span class="product-price">${product.price.toLocaleString()} ₽</span>
               <span class="product-old-price">${product.oldPrice.toLocaleString()} ₽</span>`
            : `<span class="product-price">${product.price.toLocaleString()} ₽</span>`;

        // Определяем, какое изображение использовать (URL логотипа)
        const placeholderImage = 'WhatsApp Image 2025-10-29 at 23.31.29.jpeg'; 
        
        // Устанавливаем заглушку, если product.imageUrl пуст
        const imageUrl = product.imageUrl && product.imageUrl.trim() !== '' ? product.imageUrl : placeholderImage;
        
        // Определяем класс для изображения. Если это логотип-заглушка, используем logo-placeholder
        const imageClass = imageUrl === placeholderImage ? 'logo-placeholder' : '';

        return `
            <div class="product-card" data-id="${product.id}">
                <div class="product-image">
                    <img src="${imageUrl}" 
                         alt="${product.name}" 
                         class="${imageClass}"
                         onerror="this.onerror=null; this.src='${placeholderImage}'; this.classList.add('logo-placeholder');">
                </div>
                <div class="product-info">
                    <h3>${product.name || 'Название не указано'}</h3>
                    <div class="product-meta">
                        <span>Длина: ${product.length || 'N/A'} см</span>
                        <span>Цвет: ${product.color || 'N/A'}</span>
                    </div>
                    ${priceDisplay}
                    <button class="btn-primary add-to-cart" data-id="${product.id}">
                        Добавить в корзину
                    </button>
                </div>
            </div>
        `;
    }
    /**
     * Отображает сообщение о загрузке.
     */
    renderLoading() {
        const container = document.getElementById('productsContainer');
        if (container) {
            container.innerHTML = `<p class="loading-message">Загрузка каталога... ⏳</p>`;
        }
    }
    
    /**
     * Отображает сообщение об ошибке.
     */
    renderError(message) {
        const container = document.getElementById('productsContainer');
        if (container) {
            container.innerHTML = `<div class="error-message">${message}</div>`;
        }
    }

    /**
     * Настройка всех обработчиков событий для фильтров.
     */
    setupEventListeners() {
        // Ползунки
        const lengthMin = document.getElementById('lengthMin');
        const lengthMax = document.getElementById('lengthMax');
        const priceMin = document.getElementById('priceMin');
        const priceMax = document.getElementById('priceMax');
        
        if (lengthMin && lengthMax) {
            lengthMin.addEventListener('input', () => this.handleRangeInput('length', 'min', parseInt(lengthMin.value, 10)));
            lengthMax.addEventListener('input', () => this.handleRangeInput('length', 'max', parseInt(lengthMax.value, 10)));
        }
        
        if (priceMin && priceMax) {
            priceMin.addEventListener('input', () => this.handleRangeInput('price', 'min', parseInt(priceMin.value, 10)));
            priceMax.addEventListener('input', () => this.handleRangeInput('price', 'max', parseInt(priceMax.value, 10)));
        }
        
        // Мультиселект по цвету (НОВЫЙ ОБРАБОТЧИК)
        const colorFilter = document.getElementById('colorFilter');
        if (colorFilter) {
            colorFilter.addEventListener('change', () => this.updateColorFilters());
        }
        
        // Кнопки
        const applyBtn = document.getElementById('applyFilters');
        const resetBtn = document.getElementById('resetFilters');
        if (applyBtn) applyBtn.addEventListener('click', () => this.applyFilters());
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetFilters());
    }

    /**
     * Обработчик для ползунков диапазона, который предотвращает инверсию.
     */
    handleRangeInput(type, boundary, value) {
        if (type === 'length') {
            if (boundary === 'min' && value > this.filters.maxLength) {
                value = this.filters.maxLength;
            } else if (boundary === 'max' && value < this.filters.minLength) {
                value = this.filters.minLength;
            }
            this.filters[boundary === 'min' ? 'minLength' : 'maxLength'] = value;
        } else if (type === 'price') {
            if (boundary === 'min' && value > this.filters.maxPrice) {
                value = this.filters.maxPrice;
            } else if (boundary === 'max' && value < this.filters.minPrice) {
                value = this.filters.minPrice;
            }
            this.filters[boundary === 'min' ? 'minPrice' : 'maxPrice'] = value;
        }
        
        // Убеждаемся, что HTML-ползунок соответствует исправленному значению
        const inputId = `${type}${boundary === 'min' ? 'Min' : 'Max'}`;
        document.getElementById(inputId).value = value;
        
        this.updateRangeLabels();
        // Применяем фильтры сразу, чтобы видеть изменения
        this.applyFilters();
    }
    
    /**
     * Обрабатывает изменение мультиселекта "Цвет". (НОВЫЙ МЕТОД)
     */
    updateColorFilters() {
        const selectElement = document.getElementById('colorFilter');
        if (!selectElement) return;

        // Собираем значения всех выбранных <option>
        this.filters.colors = Array.from(selectElement.selectedOptions).map(option => option.value.trim());
        
        this.applyFilters();
    }


    /**
     * Применение всех текущих фильтров к каталогу.
     */
    applyFilters() {
        const filteredProducts = this.products.filter(product => {
            // Фильтр по длине
            const lengthMatch = product.length >= this.filters.minLength && 
                              product.length <= this.filters.maxLength;
            
            // Фильтр по цене
            const priceMatch = product.price >= this.filters.minPrice && 
                             product.price <= this.filters.maxPrice;
            
            // Фильтр по цвету
            // Если массив filters.colors пуст, считаем совпадением (true)
            const colorMatch = this.filters.colors.length === 0 || 
                             this.filters.colors.includes(product.color);
            
            return lengthMatch && priceMatch && colorMatch;
        });
        
        this.renderProducts(filteredProducts);
    }

    /**
     * Сброс всех фильтров к начальным значениям.
     */
    resetFilters() {
        if (this.filterRanges) {
            // Сброс числовых фильтров к крайним значениям диапазона
            this.filters = {
                minLength: this.filterRanges.length.min,
                maxLength: this.filterRanges.length.max,
                minPrice: this.filterRanges.price.min,
                maxPrice: this.filterRanges.price.max,
                colors: [] // Сброс цвета
            };
            
            this.updateRangeSliders();
            this.updateRangeLabels();
            this.applyFilters();
            
            console.log('✅ Фильтры сброшены к начальным значениям.');
        }
    }

    /**
     * Имитация добавления товара в корзину (заменено на console.log).
     */
    addToCart(productId) {
        console.log(`🛒 Товар #${productId} добавлен в корзину!`);
    }
}

// Запускаем каталог при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    window.catalog = new HairShopCatalog();
});