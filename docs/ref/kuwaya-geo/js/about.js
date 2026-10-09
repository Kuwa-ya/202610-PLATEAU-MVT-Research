'use strict';

document.querySelectorAll('.faq-item').forEach(button => {
  button.addEventListener('click', () => {
    const content = document.getElementById(button.getAttribute('aria-controls'));
    if (!content) return;

    if (content.style.visibility === 'visible') {
      content.style.maxHeight = '0';
      content.style.opacity = '0';
      button.setAttribute('aria-expanded', 'false');
      window.setTimeout(() => {
        if (content.style.maxHeight === '0px' || content.style.maxHeight === '0') {
          content.style.visibility = 'hidden';
        }
      }, 500);
    } else {
      content.style.visibility = 'visible';
      content.style.maxHeight = `${content.scrollHeight}px`;
      content.style.opacity = '1';
      button.setAttribute('aria-expanded', 'true');
    }
  });
});
