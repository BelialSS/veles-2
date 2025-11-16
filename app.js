/**
 * Класс HairShopCatalog управляет загрузкой данных, фильтрацией и отображением товаров.
 */
class HairShopCatalog {
    constructor() {
        // URL Google Таблицы для экспорта в CSV. 
        // Важно: Таблица должна быть опубликована в Интернете (Файл -> Поделиться -> Опубликовать).
        this.CSV_URL = "https://docs.google.com/spreadsheets/d/15KZ6DHJD4zin2nATxLG-xBGx-BClYWUDAY_mW0VIwoM/export?format=csv&gid=0";
        
        this.products = [];
        this.filterRanges = null;
        this.filters = {
            minLength: 0, 
            maxLength: 0,
            minPrice: 0,
            maxPrice: 0,
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
        console.log('✅ Catalog ready for Telegram WebApp');
    }

    /**
     * Отображает индикатор загрузки.
     */
    renderLoading() {
        const container = document.getElementById('productsContainer');
        if (container) {
            container.innerHTML = '<div style="text-align: center; padding: 50px; color: #ffc400;">Загрузка данных...</div>';
        }
    }

    /**
     * Загрузка и парсинг данных из Google Таблицы в формате CSV.
     */
    async loadProductsFromCSV() {
        try {
            const response = await fetch(this.CSV_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const csvText = await response.text();
            this.products = this.parseCSV(csvText);

            // Инициализация диапазонов фильтров на основе загруженных данных
            this.initializeFilterRanges();

            this.renderProducts(this.products);
            console.log(`✅ ${this.products.length} товаров загружено!`);
        } catch (error) {
            console.error("❌ Ошибка загрузки данных:", error);
            const container = document.getElementById('productsContainer');
            if (container) {
                container.innerHTML = `<div style="text-align: center; color: #ffc400; padding: 50px;">
                    Ошибка загрузки данных. Проверьте URL CSV и настройки доступа: ${error.message}
                </div>`;
            }
        }
    }

    /**
     * Парсит CSV-текст в массив объектов (товаров).
     */
    parseCSV(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
        const products = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (!values) continue;

            const product = {};
            headers.forEach((header, index) => {
                let value = values[index] ? values[index].trim().replace(/"/g, '') : '';
                
                // Приведение типов для числовых полей
                if (header === 'id' || header === 'price' || header === 'oldprice' || header === 'length') {
                    value = parseFloat(value) || 0;
                }
                
                product[header] = value;
            });

            products.push({
                id: product.id || i,
                name: product.name || 'Без названия',
                price: product.price || 0,
                oldPrice: product.oldprice || 0,
                length: product.length || 0,
                color: product.color || 'Не указан',
                imageUrl: product.imageurl || ''
            });
        }
        return products;
    }

    /**
     * Парсит строку CSV, учитывая кавычки
     */
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result;
    }

    /**
     * Определяет минимальные и максимальные значения для фильтров.
     */
    initializeFilterRanges() {
        if (this.products.length === 0) return;

        const allLengths = this.products.map(p => p.length).filter(l => l > 0);
        const allPrices = this.products.map(p => p.price).filter(p => p > 0);
        const allColors = [...new Set(this.products.map(p => p.color).filter(c => c && c.trim() !== ''))];

        // Автоматическое определение диапазонов из данных
        const minLength = allLengths.length > 0 ? Math.floor(Math.min(...allLengths)) : 10;
        const maxLength = allLengths.length > 0 ? Math.ceil(Math.max(...allLengths)) : 50;
        const minPrice = allPrices.length > 0 ? Math.floor(Math.min(...allPrices) / 100) * 100 : 1000;
        const maxPrice = allPrices.length > 0 ? Math.ceil(Math.max(...allPrices) / 100) * 100 : 10000;

        this.filterRanges = {
            length: { min: minLength, max: maxLength },
            price: { min: minPrice, max: maxPrice }
        };

        // Обновляем фильтры и элементы управления с новыми диапазонами
        this.filters = {
            minLength: minLength,
            maxLength: maxLength,
            minPrice: minPrice,
            maxPrice: maxPrice,
            colors: []
        };
        
        this.updateFilterUI(allColors);
    }

    /**
     * Обновляет интерфейс фильтров (ползунки, метки, список цветов)
     */
    updateFilterUI(colors) {
        // Безопасное получение элементов
        const lengthMinInput = document.getElementById('lengthMin');
        const lengthMaxInput = document.getElementById('lengthMax');
        const priceMinInput = document.getElementById('priceMin');
        const priceMaxInput = document.getElementById('priceMax');
        const colorSelect = document.getElementById('colorFilter');

        if (!this.filterRanges) return;

        // Длина
        if (lengthMinInput && lengthMaxInput) {
            lengthMinInput.min = this.filterRanges.length.min;
            lengthMinInput.max = this.filterRanges.length.max;
            lengthMaxInput.min = this.filterRanges.length.min;
            lengthMaxInput.max = this.filterRanges.length.max;
            
            lengthMinInput.value = this.filters.minLength;
            lengthMaxInput.value = this.filters.maxLength;
        }

        // Цена
        if (priceMinInput && priceMaxInput) {
            priceMinInput.min = this.filterRanges.price.min;
            priceMinInput.max = this.filterRanges.price.max;
            priceMaxInput.min = this.filterRanges.price.min;
            priceMaxInput.max = this.filterRanges.price.max;
            
            priceMinInput.value = this.filters.minPrice;
            priceMaxInput.value = this.filters.maxPrice;
        }

        // Обновляем метки диапазонов
        this.updateRangeLabels();

        // Цвета
        if (colorSelect) {
            colorSelect.innerHTML = '<option value="">Все цвета</option>';
            colors.forEach(color => {
                const option = document.createElement('option');
                option.value = color;
                option.textContent = color;
                colorSelect.appendChild(option);
            });
        }
    }

    /**
     * Настройка обработчиков событий для элементов управления.
     */
    setupEventListeners() {
        // Кнопка переключения фильтров
        const filterToggle = document.getElementById('filterToggle');
        const filterSidebar = document.getElementById('filterSidebar');
        const closeFilters = document.getElementById('closeFilters');

        if (filterToggle && filterSidebar) {
            filterToggle.addEventListener('click', () => {
                filterSidebar.classList.add('active');
            });
        }

        if (closeFilters && filterSidebar) {
            closeFilters.addEventListener('click', () => {
                filterSidebar.classList.remove('active');
            });
        }

        // Закрытие фильтров при клике вне области
        document.addEventListener('click', (e) => {
            if (filterSidebar && filterSidebar.classList.contains('active') &&
                !filterSidebar.contains(e.target) && 
                !e.target.closest('#filterToggle')) {
                filterSidebar.classList.remove('active');
            }
        });

        const applyFiltersBtn = document.getElementById('applyFilters');
        const resetFiltersBtn = document.getElementById('resetFilters');

        const lengthMinInput = document.getElementById('lengthMin');
        const lengthMaxInput = document.getElementById('lengthMax');
        const priceMinInput = document.getElementById('priceMin');
        const priceMaxInput = document.getElementById('priceMax');

        // События для обновления значений при движении ползунков
        [lengthMinInput, lengthMaxInput, priceMinInput, priceMaxInput].forEach(input => {
            if (input) {
                input.addEventListener('input', () => this.updateRangeLabels());
            }
        });

        // Событие для кнопки "Применить фильтры"
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => {
                this.getFilterValues();
                this.applyFilters();
                // Закрываем фильтры на мобильных после применения
                if (window.innerWidth <= 900) {
                    filterSidebar.classList.remove('active');
                }
            });
        }

        // Событие для кнопки "Сбросить"
        if (resetFiltersBtn) {
            resetFiltersBtn.addEventListener('click', () => this.resetFilters());
        }

        // Событие для добавления в корзину (используем делегирование)
        const productsContainer = document.getElementById('productsContainer');
        if (productsContainer) {
            productsContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('add-to-cart')) {
                    const productId = e.target.getAttribute('data-id');
                    this.addToCart(productId);
                }
            });
        }
    }

    /**
     * Обновляет текстовые метки для текущих значений ползунков.
     */
    updateRangeLabels() {
        const lengthMinInput = document.getElementById('lengthMin');
        const lengthMaxInput = document.getElementById('lengthMax');
        const priceMinInput = document.getElementById('priceMin');
        const priceMaxInput = document.getElementById('priceMax');

        const lengthValue = document.getElementById('lengthValue');
        const priceValue = document.getElementById('priceValue');

        // Обновление меток текущих значений
        if (lengthMinInput && lengthMaxInput && lengthValue) {
            const lengthMin = parseInt(lengthMinInput.value);
            const lengthMax = parseInt(lengthMaxInput.value);

            // Убеждаемся, что min не больше max
            if (lengthMin > lengthMax) {
                lengthMinInput.value = lengthMax;
            }

            lengthValue.textContent = `${Math.min(lengthMin, lengthMax)}-${Math.max(lengthMin, lengthMax)} см`;
        }

        if (priceMinInput && priceMaxInput && priceValue) {
            const priceMin = parseInt(priceMinInput.value);
            const priceMax = parseInt(priceMaxInput.value);

            if (priceMin > priceMax) {
                priceMinInput.value = priceMax;
            }

            priceValue.textContent = `${Math.min(priceMin, priceMax)}-${Math.max(priceMin, priceMax)} ₽`;
        }

        // Обновление минимальных и максимальных меток
        const lengthMinLabel = document.getElementById('lengthMinLabel');
        const lengthMaxLabel = document.getElementById('lengthMaxLabel');
        const priceMinLabel = document.getElementById('priceMinLabel');
        const priceMaxLabel = document.getElementById('priceMaxLabel');

        if (this.filterRanges) {
            if (lengthMinLabel) lengthMinLabel.textContent = `${this.filterRanges.length.min} см`;
            if (lengthMaxLabel) lengthMaxLabel.textContent = `${this.filterRanges.length.max} см`;
            if (priceMinLabel) priceMinLabel.textContent = `${this.filterRanges.price.min} ₽`;
            if (priceMaxLabel) priceMaxLabel.textContent = `${this.filterRanges.price.max} ₽`;
        }
    }

    /**
     * Собирает текущие значения фильтров из элементов управления.
     */
    getFilterValues() {
        const lengthMinInput = document.getElementById('lengthMin');
        const lengthMaxInput = document.getElementById('lengthMax');
        const priceMinInput = document.getElementById('priceMin');
        const priceMaxInput = document.getElementById('priceMax');
        const colorFilter = document.getElementById('colorFilter');

        const selectedColors = colorFilter ? Array.from(colorFilter.selectedOptions)
                                   .filter(option => option.value !== '')
                                   .map(option => option.value) : [];

        this.filters = {
            minLength: lengthMinInput ? parseInt(lengthMinInput.value) : this.filters.minLength,
            maxLength: lengthMaxInput ? parseInt(lengthMaxInput.value) : this.filters.maxLength,
            minPrice: priceMinInput ? parseInt(priceMinInput.value) : this.filters.minPrice,
            maxPrice: priceMaxInput ? parseInt(priceMaxInput.value) : this.filters.maxPrice,
            colors: selectedColors
        };

        console.log('🔍 Текущие фильтры:', this.filters);
    }

    /**
     * Рендеринг списка товаров в контейнере.
     */
    renderProducts(products) {
        const container = document.getElementById('productsContainer');
        if (!container) return;

        if (products.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 50px; color: #ffc400;">По вашим критериям товары не найдены.</div>';
            return;
        }

        container.innerHTML = products.map(product => this.createProductCard(product)).join('');
    }

    /**
     * Создает HTML-разметку для одной карточки товара.
     */
    createProductCard(product) {
        const hasDiscount = product.oldPrice && product.oldPrice > product.price;
        const priceDisplay = hasDiscount 
            ? `<span class="product-price">${product.price.toLocaleString()} ₽</span>
               <span class="product-old-price">${product.oldPrice.toLocaleString()} ₽</span>`
            : `<span class="product-price">${product.price.toLocaleString()} ₽</span>`;

        const imageUrl = product.imageUrl && product.imageUrl.trim() !== '' ? product.imageUrl : '';
        const imageClass = imageUrl === '' ? 'no-image' : '';

        return `
            <div class="product-card" data-id="${product.id}">
                <div class="product-image ${imageClass}">
                    ${imageUrl ? 
                        `<img src="${imageUrl}" alt="${product.name}" onerror="this.style.display='none'; this.parentElement.classList.add('no-image');">` : 
                        '📷 Нет фото'
                    }
                </div>
                <div class="product-info">
                    <h3>${product.name}</h3>
                    <div class="product-meta">
                        <span>Длина: ${product.length} см</span>
                        <span>Цвет: ${product.color}</span>
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
     * Применяет текущие фильтры к списку товаров и обновляет отображение.
     */
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
        console.log(`🔍 Отображено ${filteredProducts.length} из ${this.products.length} товаров`);
    }

    /**
     * Сброс всех фильтров к начальным значениям.
     */
    resetFilters() {
        if (this.filterRanges) {
            this.filters = {
                minLength: this.filterRanges.length.min,
                maxLength: this.filterRanges.length.max,
                minPrice: this.filterRanges.price.min,
                maxPrice: this.filterRanges.price.max,
                colors: []
            };
            
            // Сброс визуальных элементов
            const lengthMinInput = document.getElementById('lengthMin');
            const lengthMaxInput = document.getElementById('lengthMax');
            const priceMinInput = document.getElementById('priceMin');
            const priceMaxInput = document.getElementById('priceMax');
            const colorFilter = document.getElementById('colorFilter');
            
            if (lengthMinInput) lengthMinInput.value = this.filters.minLength;
            if (lengthMaxInput) lengthMaxInput.value = this.filters.maxLength;
            if (priceMinInput) priceMinInput.value = this.filters.minPrice;
            if (priceMaxInput) priceMaxInput.value = this.filters.maxPrice;
            if (colorFilter) colorFilter.selectedIndex = 0;
            
            this.updateRangeLabels();
            this.applyFilters();
            
            console.log('✅ Фильтры сброшены');
        }
    }

    /**
     * Добавление товара в корзину
     */
    addToCart(productId) {
        const product = this.products.find(p => p.id == productId);
        if (product) {
            console.log(`🛒 Товар "${product.name}" добавлен в корзину!`);
            // Здесь можно добавить логику для реальной корзины
        }
    }
}

// Запускаем каталог при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    window.catalog = new HairShopCatalog();
});