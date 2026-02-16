document.addEventListener("DOMContentLoaded", function () {

    emailjs.init({
        publicKey: "KHFTFz6fQNuIZHk6F"
    });

    const form = document.getElementById("contact-form");
    const status = document.getElementById("form-status");

    if (!form) return;

    form.addEventListener("submit", function (e) {
        e.preventDefault();

        status.innerHTML = "Enviando mensagem...";
        status.className = "form-status sending";

        // Pega nome e sobrenome
        const firstName = form.querySelector('[name="first_name"]').value;
        const lastName = form.querySelector('[name="last_name"]').value;

        // Remove input hidden antigo se existir
        const existingHidden = form.querySelector('[name="user_name"]');
        if (existingHidden) existingHidden.remove();

        // Cria campo user_name
        const hiddenInput = document.createElement("input");
        hiddenInput.type = "hidden";
        hiddenInput.name = "user_name";
        hiddenInput.value = firstName + " " + lastName;
        form.appendChild(hiddenInput);

        emailjs.sendForm("service_18pzw78", "template_0cf2mqn", form)
            .then(function () {
                status.innerHTML = "Mensagem enviada com sucesso!";
                status.className = "form-status success";
                form.reset();
            })
            .catch(function (error) {
                status.innerHTML = "Erro ao enviar. Tente novamente.";
                status.className = "form-status error";
                console.error("Erro EmailJS:", error);
            });
    });

});
