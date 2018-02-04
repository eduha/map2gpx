var msgs = [
    'Génération des montagnes...',
    'Ajout des ruisseaux...',
    'Remplissage des lacs...',
    'Danse du soleil...',
    'Appel des marmottes...',
    'Plantation de lis des Alpes...',
    'Ajout des bouquetins...',
    'Surveillance des salamandres tachetées...',
    'Recherche de campanule barbue...',
    'Découverte d\'une hermine...',
    'Tentative de lutte contre le réchauffement climatique...',
];

function showLoadingMessage(m) {
    $('<div>' + m + '</div>').insertAfter($('#loading h3')).fadeOut(2000, function () {$(this).remove();});
}

var endOfMessage = 0;
var gotError = false;
var interval = window.setInterval(function () {
    var m = msgs.shift();
    if (m === undefined) {
        m = Math.random().toString(36).substr(2);

        if (!gotError) {
            if (endOfMessage == 0) {
                $('<div>Le chargement prend plus de temps que prévu...</div>').hide().prependTo($('#loading h3')).slideDown();
                $('#loading').animate({ backgroundColor: '#C0C0C0' });
            } else if (endOfMessage == 5) {
                $('#loading h2 i.fa').removeClass('fa-pulse').addClass('fa-spin');
                $('<div>Une erreur s\'est peut-être produite. ' +
                    'N\'hésitez pas à ouvrir un ticket sur <a href="https://github.com/tmuguet/map2gpx" target="_blank" rel="noopener noreferrer">Github</a> ' +
                    'ou à m\'envoyer un mail à <a href="mailto:hi@tmuguet.me">hi@tmuguet.me</a>.</div>')
                    .hide().appendTo($('#loading h3')).slideDown();
                $('#loading').animate({ backgroundColor: '#999999', color: '#FFFFFF' });
            } else if (endOfMessage > 5 && endOfMessage < 15) {
                var color = 14 - endOfMessage;
                $('#loading').animate({ backgroundColor: '#' + color.toString().repeat(6) });
            }

            endOfMessage++;
        }
    }

    showLoadingMessage(m);

}, 800);

showLoadingMessage('Chargement des bibliothèques...');
