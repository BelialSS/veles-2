/**
 * Класс HairShopCatalog управляет загрузкой данных, фильтрацией и отображением товаров.
 */
class HairShopCatalog {
    constructor() {
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
        
        this.cart = [];
        this.favorites = [];
        this.purchases = [];
        this.telegramUser = null;
        this.userAddresses = [];
        this.selectedAddress = null;
        this.deliveryMethod = 'pickup';
        this.paymentMethod = 'cash';
        
        this.init();
    }

    /**
     * Инициализация приложения
     */
    async init() {
        this.initTelegram();
        this.initAddressSystem();
        this.renderLoading();
        await this.loadProductsFromCSV();
        this.setupEventListeners();
        this.updateCartCount();
        this.updateFavoritesCount();
        console.log('✅ Catalog ready for Telegram WebApp');
    }

    /**
     * Инициализация системы адресов
     */
    initAddressSystem() {
        this.userAddresses = JSON.parse(localStorage.getItem('userAddresses') || '[]');
        this.selectedAddress = null;
    }

    /**
     * Инициализация Telegram WebApp
     */
    initTelegram() {
        if (window.Telegram && Telegram.WebApp) {
            this.telegramUser = Telegram.WebApp.initDataUnsafe?.user;
            Telegram.WebApp.expand();
            Telegram.WebApp.ready();
            
            console.log('✅ Telegram WebApp initialized');
            console.log('👤 User:', this.telegramUser);
        } else {
            console.log('⚠️ Telegram WebApp not detected, running in browser mode');
            this.telegramUser = {
                first_name: 'Тестовый',
                last_name: 'Пользователь',
                username: 'test_user',
                photo_url: ''
            };
        }
    }

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        // Существующие обработчики...
        this.setupNavigationListeners();
        this.setupCartListeners();
        this.setupCheckoutListeners();
        this.setupAddressListeners();
        this.setupFilterListeners();
    }

    /**
     * Обработчики навигации
     */
    setupNavigationListeners() {
        // Кнопки перехода между экранами
        document.getElementById('cartBtn').addEventListener('click', () => this.showCartScreen());
        document.getElementById('checkoutBtn').addEventListener('click', () => this.showCheckoutScreen());
        document.getElementById('backFromCheckout').addEventListener('click', () => this.showCartScreen());
        document.getElementById('backFromCart').addEventListener('click', () => this.showCatalogScreen());
        
        // Выбор способа доставки
        document.querySelectorAll('input[name="delivery"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.deliveryMethod = e.target.value;
                this.toggleAddressSection();
            });
        });

        // Выбор способа оплаты
        document.querySelectorAll('input[name="payment"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.paymentMethod = e.target.value;
            });
        });

        // Подтверждение заказа
        document.getElementById('confirmOrderBtn').addEventListener('click', () => this.confirmOrder());
    }

    /**
     * Обработчики корзины
     */
    setupCartListeners() {
        // Делегирование событий для корзины
        document.getElementById('cartItems').addEventListener('click', (e) => {
            if (e.target.classList.contains('decrease-btn')) {
                this.updateCartQuantity(e.target.getAttribute('data-id'), 'decrease');
            } else if (e.target.classList.contains('increase-btn')) {
                this.updateCartQuantity(e.target.getAttribute('data-id'), 'increase');
            } else if (e.target.classList.contains('remove-btn')) {
                this.removeFromCart(e.target.getAttribute('data-id'));
            }
        });
    }

    /**
     * Обработчики оформления заказа
     */
    setupCheckoutListeners() {
        // Выбор адреса доставки
        document.getElementById('selectAddressBtn').addEventListener('click', () => {
            this.showAddressModal();
        });
    }

    /**
     * Обработчики системы адресов
     */
    setupAddressListeners() {
        const addressModal = document.getElementById('addressModal');
        const newAddressModal = document.getElementById('newAddressModal');
        const addNewAddressBtn = document.getElementById('addNewAddressBtn');
        const cancelAddressBtn = document.getElementById('cancelAddressBtn');
        const newAddressForm = document.getElementById('newAddressForm');

        // Закрытие модальных окон
        window.addEventListener('click', (e) => {
            if (e.target === addressModal) this.hideAddressModal();
            if (e.target === newAddressModal) this.hideNewAddressModal();
        });

        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.hideAddressModal();
                this.hideNewAddressModal();
            });
        });

        // Добавление нового адреса
        addNewAddressBtn.addEventListener('click', () => this.showNewAddressModal());
        cancelAddressBtn.addEventListener('click', () => {
            this.hideNewAddressModal();
            this.showAddressModal();
        });

        // Сохранение нового адреса
        newAddressForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(newAddressForm);
            const addressData = {
                city: formData.get('city'),
                street: formData.get('street'),
                house: formData.get('house'),
                apartment: formData.get('apartment'),
                deliveryCompany: formData.get('deliveryCompany')
            };
            this.saveNewAddress(addressData);
        });
    }

    /**
     * Переключение секции адреса
     */
    toggleAddressSection() {
        const addressSection = document.getElementById('addressSection');
        if (this.deliveryMethod === 'delivery') {
            addressSection.style.display = 'block';
        } else {
            addressSection.style.display = 'none';
        }
    }

    /**
     * Показывает модальное окно выбора адреса
     */
    showAddressModal() {
        document.getElementById('addressModal').style.display = 'block';
        this.renderSavedAddresses();
    }

    /**
     * Скрывает модальное окно выбора адреса
     */
    hideAddressModal() {
        document.getElementById('addressModal').style.display = 'none';
    }

    /**
     * Показывает модальное окно добавления адреса
     */
    showNewAddressModal() {
        this.hideAddressModal();
        document.getElementById('newAddressModal').style.display = 'block';
    }

    /**
     * Скрывает модальное окно добавления адреса
     */
    hideNewAddressModal() {
        document.getElementById('newAddressModal').style.display = 'none';
    }

    /**
     * Рендерит список сохраненных адресов
     */
    renderSavedAddresses() {
        const container = document.getElementById('savedAddresses');
        
        if (this.userAddresses.length === 0) {
            container.innerHTML = '<div class="empty-addresses">🏠 У вас пока нет сохраненных адресов</div>';
            return;
        }

        container.innerHTML = this.userAddresses.map((address, index) => `
            <div class="address-item ${this.selectedAddress === index ? 'selected' : ''}" 
                 data-index="${index}">
                <div class="address-main">
                    ${address.city}, ул. ${address.street}, д. ${address.house}
                    ${address.apartment ? `, кв. ${address.apartment}` : ''}
                </div>
                <div class="address-details">
                    ${this.getDeliveryCompanyName(address.deliveryCompany)}
                </div>
            </div>
        `).join('');

        // Обработчики выбора адреса
        container.addEventListener('click', (e) => {
            const addressItem = e.target.closest('.address-item');
            if (addressItem) {
                const index = parseInt(addressItem.getAttribute('data-index'));
                this.selectAddress(index);
            }
        });
    }

    /**
     * Выбирает адрес доставки
     */
    selectAddress(index) {
        this.selectedAddress = index;
        this.renderSavedAddresses();
        this.updateCheckoutAddressDisplay();
        this.hideAddressModal();
    }

    /**
     * Сохраняет новый адрес
     */
    saveNewAddress(formData) {
        const newAddress = {
            id: Date.now(),
            city: formData.city.trim(),
            street: formData.street.trim(),
            house: formData.house.trim(),
            apartment: formData.apartment ? formData.apartment.trim() : '',
            deliveryCompany: formData.deliveryCompany,
            createdAt: new Date().toISOString()
        };

        this.userAddresses.push(newAddress);
        localStorage.setItem('userAddresses', JSON.stringify(this.userAddresses));
        this.selectedAddress = this.userAddresses.length - 1;
        this.hideNewAddressModal();
        this.showNotification('✅ Адрес успешно сохранен!');
        this.updateCheckoutAddressDisplay();
    }

    /**
     * Обновляет отображение адреса на странице оформления заказа
     */
    updateCheckoutAddressDisplay() {
        const addressElement = document.getElementById('selectedAddress');
        if (addressElement && this.selectedAddress !== null) {
            const address = this.userAddresses[this.selectedAddress];
            addressElement.innerHTML = `
                <div class="address-main">
                    ${address.city}, ул. ${address.street}, д. ${address.house}
                    ${address.apartment ? `, кв. ${address.apartment}` : ''}
                </div>
                <div class="address-details">
                    ${this.getDeliveryCompanyName(address.deliveryCompany)}
                </div>
            `;
            addressElement.classList.remove('empty');
        }
    }

    /**
     * Получает название транспортной компании
     */
    getDeliveryCompanyName(code) {
        const companies = {
            'cdek': 'СДЭК',
            'boxberry': 'Boxberry',
            'russian_post': 'Почта России',
            'dhl': 'DHL',
            'dpd': 'DPD',
            'yandex': 'Яндекс Доставка'
        };
        return companies[code] || code;
    }

    /**
     * Показывает экран оформления заказа
     */
    showCheckoutScreen() {
        if (this.cart.length === 0) {
            this.showNotification('🛒 Корзина пуста');
            return;
        }

        document.getElementById('catalogScreen').classList.remove('active');
        document.getElementById('cartScreen').classList.remove('active');
        document.getElementById('checkoutScreen').classList.add('active');
        
        this.renderCheckoutItems();
        this.toggleAddressSection();
        this.updateCheckoutAddressDisplay();
    }

    /**
     * Рендерит товары на странице оформления заказа
     */
    renderCheckoutItems() {
        const container = document.getElementById('orderItems');
        const totalElement = document.getElementById('checkoutTotalAmount');
        
        const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        totalElement.textContent = `${total.toLocaleString()} ₽`;

        container.innerHTML = this.cart.map(item => `
            <div class="order-item">
                <div class="order-item-image">
                    ${item.imageUrl ? 
                        `<img src="${item.imageUrl}" alt="${item.name}">` : 
                        '📷'
                    }
                </div>
                <div class="order-item-info">
                    <div class="order-item-name">${item.name}</div>
                    <div class="order-item-meta">
                        <span>${item.length} см • ${item.color}</span>
                        <span class="order-item-quantity">${item.quantity} шт</span>
                    </div>
                </div>
                <div class="order-item-price">
                    ${(item.price * item.quantity).toLocaleString()} ₽
                </div>
            </div>
        `).join('');
    }

    /**
     * Подтверждение заказа
     */
    confirmOrder() {
        if (this.deliveryMethod === 'delivery' && this.selectedAddress === null) {
            this.showNotification('🚚 Пожалуйста, выберите адрес доставки');
            return;
        }

        const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const orderDetails = this.cart.map(item => 
            `• ${item.name} - ${item.quantity} × ${item.price.toLocaleString()} ₽`
        ).join('\n');

        const deliveryInfo = this.deliveryMethod === 'delivery' ? 
            `🏠 Адрес доставки: ${this.userAddresses[this.selectedAddress].city}, ул. ${this.userAddresses[this.selectedAddress].street}, д. ${this.userAddresses[this.selectedAddress].house}` :
            '🏪 Самовывоз из магазина';

        const paymentMethods = {
            'cash': 'Наличными',
            'card': 'Перевод на карту',
            'online': 'Онлайн оплата',
            'sbp': 'СБП'
        };

        const message = `🛍️ Заказ подтвержден!\n\n` +
                       `👤 Покупатель: ${this.telegramUser?.first_name || 'Неизвестно'}\n` +
                       `🚚 Способ получения: ${this.deliveryMethod === 'delivery' ? 'Доставка' : 'Самовывоз'}\n` +
                       `${deliveryInfo}\n` +
                       `💳 Способ оплаты: ${paymentMethods[this.paymentMethod]}\n\n` +
                       `📦 Товары:\n${orderDetails}\n\n` +
                       `💎 Итого: ${total.toLocaleString()} ₽\n\n` +
                       `🕐 Время: ${new Date().toLocaleString()}`;

        // Сохраняем покупку
        this.purchases.push({
            id: Date.now(),
            date: new Date(),
            items: [...this.cart],
            total: total,
            delivery: this.deliveryMethod,
            payment: this.paymentMethod,
            address: this.deliveryMethod === 'delivery' ? this.userAddresses[this.selectedAddress] : null
        });

        alert(message);
        
        // Очищаем корзину
        this.cart = [];
        this.updateCartCount();
        this.showCatalogScreen();
        this.products.forEach(product => this.updateProductCard(product.id));
    }

    // ... остальные методы (loadProductsFromCSV, parseCSV, renderProducts и т.д.) остаются без изменений
    // Убедитесь, что все предыдущие методы также присутствуют в классе
}

// Запускаем каталог при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    window.catalog = new HairShopCatalog();
});