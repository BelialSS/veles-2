document.addEventListener('DOMContentLoaded', function() {
    console.log('Hair Shop Catalog loaded!');
    
    // Добавляем интерактивность
    const cards = document.querySelectorAll('.category-card');
    cards.forEach(card => {
        card.addEventListener('click', function() {
            alert('Категория: ' + this.querySelector('h3').textContent);
        });
    });
    
    // Показываем приветственное сообщение
    setTimeout(() => {
        console.log('✅ Catalog ready for Telegram WebApp');
    }, 1000);
});