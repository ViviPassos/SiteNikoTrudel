// Funções auxiliares para slide (imitam jQuery slideUp/Down/Toggle)
function slideUp(target, duration = 200) {
  target.style.transitionProperty = 'max-height, margin, padding';
  target.style.transitionDuration = duration + 'ms';
  target.style.maxHeight = target.scrollHeight + 'px'; // força reflow
  requestAnimationFrame(() => {
    target.style.maxHeight = '0';
  });
  setTimeout(() => {
    target.style.transitionProperty = '';
    target.style.transitionDuration = '';
  }, duration);
}

function slideDown(target, duration = 200) {
  target.style.transitionProperty = 'max-height, margin, padding';
  target.style.transitionDuration = duration + 'ms';
  target.style.maxHeight = '0'; // força reflow
  requestAnimationFrame(() => {
    target.style.maxHeight = target.scrollHeight + 'px';
  });
  setTimeout(() => {
    target.style.maxHeight = '';
    target.style.transitionProperty = '';
    target.style.transitionDuration = '';
  }, duration);
}

function slideToggle(target, duration = 200) {
  if (window.getComputedStyle(target).maxHeight === '0px') {
    slideDown(target, duration);
  } else {
    slideUp(target, duration);
  }
}

const scrollTopBtn = document.getElementById("scrollTopBtn");

window.addEventListener("scroll", () => {
  if (window.scrollY > 300) {
    scrollTopBtn.classList.add("show");
  } else {
    scrollTopBtn.classList.remove("show");
  }
});

scrollTopBtn.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const elements = document.querySelectorAll(".reveal-text, .reveal-card");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("active");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.2
    }
  );

  elements.forEach(el => observer.observe(el));
});


// ==============================
// INÍCIO DO CÓDIGO PRINCIPAL
// ==============================

document.addEventListener('DOMContentLoaded', function () {

  // Mobile nav toggle
  const toggle = document.querySelector('.mobile-nav-toggle');
  const navContainer = document.querySelector('.main-nav');  // o pai do menu
  const navList = document.querySelector('.main-nav .nav');

  if (toggle && navList) {
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      document.body.classList.toggle('mobile-nav-active');

      // Troca ícone
      toggle.classList.toggle('bi-list');
      toggle.classList.toggle('bi-x');
    });

    // Fecha ao clicar em link
    navList.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', function () {
        document.body.classList.remove('mobile-nav-active');
        toggle.classList.add('bi-list');
        toggle.classList.remove('bi-x');
      });
    });

    // Fecha ao clicar fora do menu (qualquer lugar na tela fora do painel)
    document.addEventListener('click', function (e) {
      if (
        document.body.classList.contains('mobile-nav-active') &&
        !navContainer.contains(e.target) &&
        e.target !== toggle
      ) {
        document.body.classList.remove('mobile-nav-active');
        toggle.classList.add('bi-list');
        toggle.classList.remove('bi-x');
      }
    });
  }

  // Header scrolled (mantido igual)
  const header = document.querySelector('header');
  const headerText = document.querySelector('.header-text');

  if (header && headerText) {
    window.addEventListener('scroll', function () {
      const scroll = window.scrollY;
      const box = headerText.offsetHeight || 0;
      const headerHeight = header.offsetHeight || 80;

      if (scroll >= box - headerHeight) {
        header.classList.add('background-header');
      } else {
        header.classList.remove('background-header');
      }
    });
  }

  // Smooth scroll to section
  document.querySelectorAll('.scroll-to-section a[href^="#"]:not([href="#"])').forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();

      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        if (document.body.classList.contains('mobile-nav-active')) {
          document.body.classList.remove('mobile-nav-active');
          if (toggle) {
            toggle.classList.add('bi-list');
            toggle.classList.remove('bi-x');
          }
        }
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Active link on scroll
  function updateActiveLink() {
    const scrollPos = window.scrollY;
    document.querySelectorAll('.nav a').forEach(link => {
      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) return;

      const section = document.querySelector(href);
      if (!section) return;

      const top = section.offsetTop - 100;
      const height = section.offsetHeight;

      if (top <= scrollPos && top + height > scrollPos) {
        document.querySelectorAll('.nav a').forEach(a => a.classList.remove('active'));
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  window.addEventListener('scroll', updateActiveLink);
  updateActiveLink();

  // Preloader
  window.addEventListener('load', function () {
    const preloader = document.querySelector('#js-preloader');
    if (preloader) preloader.classList.add('loaded');
  });


});