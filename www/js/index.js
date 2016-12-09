var $ = window.$;
var eventpages = {};
var frontpage = {};
var infopage = {};
var eventsInitialized = false;
var mapInitialized = false;
var map = null;

function shuffle(a) {
  var j, x, i;
  for (i = a.length; i; i--) {
    j = Math.floor(Math.random() * i);
    x = a[i - 1];
    a[i - 1] = a[j];
    a[j] = x;
  }
}

var app = {
  // Application Constructor
  initialize: function () {
    this.bindEvents();
  },
  // Bind Event Listeners
  //
  // Bind any events that are required on startup. Common events are:
  // 'load', 'deviceready', 'offline', and 'online'.
  bindEvents: function () {
    document.addEventListener('deviceready', this.onDeviceReady, false);
  },
  // deviceready Event Handler
  //
  // The scope of 'this' is the event.
  onDeviceReady: function () {
    $.getJSON('http://localhost:1234/wp-json/wp/v2/mobilepage?per_page=100', function (posts) {
      //app.initApp(posts);
    }).fail(function (err) {
      $('.load-error')
        .empty()
        .append('<p>Virhe ladattaessa sisältöä, yritetään uudelleen...</p>');
      setTimeout(function () {
        app.onDeviceReady();
      }, 2000);
    });
  },
  initApp: function (posts) {
    moment.locale('fi');
    var slides = [];
    for (var i = 0; i < posts.length; i++) {
      var post = posts[i];
      switch (post['metatavu-app-management-type']) {
        case 'frontpage':
          frontpage = {
            title: post.title.rendered,
            content: post.content.rendered,
          };
          break;
        case 'info':
          infopage = {
            title: post.title.rendered,
            content: post.content.rendered,
          };
          break;
        case 'event':
          var open = post['metatavu-app-management-open'];
          var openMoment = open.map(function (eventOpen) {
            return {
              date: eventOpen.date,
              opens: moment(eventOpen.date + ' ' + eventOpen.opens, 'D.M. H:mm'),
              closes: moment(eventOpen.date + ' ' + eventOpen.closes, 'D.M. H:mm')
            };
          });
          //TODO: convert to  template
          var extraContent = '<p><b>Missä:</b><br/>' + post['metatavu-app-management-location']['text'] + '</p><p><b>Milloin:</b><br/>';
          for (var j = 0; j < openMoment.length; j++) {
            extraContent += '<span>' + openMoment[j].opens.format('dd D.M. H:mm') + ' - ' + openMoment[j].closes.format('H:mm') + '</span><br/>';
          }
          eventpages[post.slug] = {
            slug: post.slug,
            title: post.title.rendered,
            content: post.content.rendered + extraContent,
            latitude: post['metatavu-app-management-location']['lat'],
            longitude: post['metatavu-app-management-location']['lng'],
            locationText: post['metatavu-app-management-location']['text'],
            dates: open.map(function (eventOpen) { return eventOpen.date; }),
            open: openMoment
          }
          slides.push(post.slug);
          break;
      }
    }
    slides.sort();
    for (var i = 0; i < slides.length; i++) {
      var slide = slides[i];
      //TODO: convert to template
      var slideContainer = $('<div></div>');
      slideContainer.addClass('swiper-slide');
      slideContainer.append($('<div></div>')
        .addClass('swiper-container')
        .addClass('swiper-container-inner')
        .append(
        $('<div></div>')
          .addClass('swiper-wrapper')
          .append(
          $('<div></div>')
            .addClass('swiper-slide')
            .append(
            $('<h3></h3>')
              .addClass('content-title')
              .html(eventpages[slide].title)
            )
            .append(
            $('<div></div>')
              .addClass('main-content')
              .html(eventpages[slide].content)
            )
          )
        )
        .append(
        $('<div></div>')
          .addClass('swiper-scrollbar')
        )
      );
      $('.events-wrapper').append(slideContainer);
    }
    $('.menu-item').click(function () {
      var target = $(this).attr('data-target');
      $('.active').removeClass('active');
      $(this).parent().addClass('active');
      $('.navbar-toggle').click();
      switch (target) {
        case 'frontpage':
          app.renderFrontPage();
          break;
        case 'info':
          app.renderInfoPage();
          break;
        case 'events':
          app.renderEventsPage();
          break;
        case 'map':
          app.renderMapPage();
          break;
        case 'timetable':
          app.renderTimeTable();
          break;
      }
    });
    $(document).on('click', '.date-timetable', function () {
      var date = $(this).attr('data-date');
      app.renderTimeTable(date);
    });
    $(document).on('click', '.show-event-data', function () {
      var slug = $(this).attr('data-slug');
      var event = eventpages[slug];
      bootbox.dialog({
        title: event.title,
        message: event.content
      });
    });
    $('.load-container').hide();
    app.renderFrontPage();
  },
  renderPage: function (page) {
    $('.default-container .main-content').html(page.content);
    $('.default-container .content-title').text(page.title);
    $('.events-container').hide();
    $('.map-container').hide();
    $('.default-container').show();
  },
  renderFrontPage: function () {
    var currentMoment = moment();
    var currentEvents = [];
    for (var slug in eventpages) {
      var event = eventpages[slug];
      for (var j = 0; j < event.open.length; j++) {
        var eventOpen = event.open[j];
        if (eventOpen.opens.isBefore(currentMoment) && eventOpen.closes.isAfter(currentMoment)) {
          currentEvents.push(event);
          break;
        }
      }
    }
    shuffle(currentEvents);
    var frontPageEvents = currentEvents.slice(0,3);
    var content = frontpage.content;
    content += '<br/><p><b>Juuri nyt:</b></p><table class="table">';
    for(var n = 0; n < frontPageEvents.length;n++){
      content += '<tr><td><a class="show-event-data" data-slug="' + frontPageEvents[n].slug + '" href="#">' + frontPageEvents[n].title + '</a></td></tr>';
    }
    content += '</table>';
    var page = {
      title: frontpage.title,
      content: content
    }
    app.renderPage(page);
  },
  renderInfoPage: function () {
    app.renderPage(infopage);
  },
  renderMapPage: function () {
    $('.default-container').hide();
    $('.events-container').hide();
    $('.map-container').show();
    if (!mapInitialized) {
      mapInitialized = true;
      var layer = new L.StamenTileLayer('toner');
      map = new L.Map('map', {
        maxZoom: 16
      });
      map.addLayer(layer);
      for (var slug in eventpages) {
        if (eventpages.hasOwnProperty(slug)) {
          var event = eventpages[slug];
          var marker = L.marker({
            lat: event.latitude,
            lng: event.longitude
          }).addTo(map);
          marker.on('click', function (event) {
            return function () {
              bootbox.dialog({
                title: event.title,
                message: event.content
              });
            };
          } (event));
        }
      }
      map.setView({
        lat: 61.688727,
        lng: 27.272146
      }, 14);
    }
    navigator.geolocation.getCurrentPosition(function (pos) {
      map.setView({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      }, 14);
    }, function (err) {
      //If position is not available for some reason, use mikkeli centre which is already initialized
    });
  },
  renderEventsPage: function () {
    $('.default-container').hide();
    $('.map-container').hide();
    $('.events-container').show();
    if (!eventsInitialized) {
      eventsInitialized = true;
      new Swiper('.events-container', {});
      new Swiper('.swiper-container-inner', {
        scrollbar: '.swiper-scrollbar',
        direction: 'vertical',
        slidesPerView: 'auto',
        mousewheelControl: true,
        freeMode: true,
        autoHeight: true
      });
    }
  },
  renderTimeTable: function (date) {
    if (typeof date == 'undefined') {
      var dates = [];
      for (var slug in eventpages) {
        if (eventpages.hasOwnProperty(slug)) {
          var event = eventpages[slug];
          for (var i = 0; i < event.dates.length; i++) {
            if (dates.indexOf(event.dates[i]) == -1) {
              dates.push(event.dates[i]);
            }
          }
        }
      }
      var moments = [];
      for (var j = 0; j < dates.length; j++) {
        moments.push(moment(dates[j], 'D.M.'));
      }
      moments = moments.sort(function (a, b) {
        if (a.isBefore(b)) {
          return -1;
        } else if (b.isBefore(a)) {
          return 1;
        } else {
          return 0;
        }
      });
      //TODO: use template
      var content = '<table class="table">';
      for (var n = 0; n < moments.length; n++) {
        content += '<tr><td><a data-date="' + moments[n].format('D.M.') + '" class="date-timetable" href="#">' + moments[n].format('dddd D.M') + '</a></td></tr>';
      }
      content += '</table>';
      $('.default-container .main-content').html(content);
      $('.default-container .content-title').text('Aikataulu');
      $('.events-container').hide();
      $('.map-container').hide();
      $('.default-container').show();
    } else {
      var events = [];
      for (var slug in eventpages) {
        if (eventpages.hasOwnProperty(slug)) {
          var event = eventpages[slug];
          if (event.dates.indexOf(date) !== -1) {
            events.push(event);
          }
        }
      }
      for (var i = 0; i < events.length; i++) {
        for (var j = 0; j < events[i].open.length; j++) {
          if (events[i].open[j].date == date) {
            events[i].currentOpen = events[i].open[j];
            break;
          }
        }
      }
      events = events.sort(function (a, b) {
        if (a.currentOpen.opens.isBefore(b.currentOpen.opens)) {
          return -1;
        } else if (b.currentOpen.opens.isBefore(a.currentOpen.opens)) {
          return 1;
        } else {
          return 0;
        }
      });
      var content = '<table class="table">';
      for (var j = 0; j < events.length; j++) {
        content += '<tr><td><a class="show-event-data" data-slug="' + events[j].slug + '" href="#">' + events[j].currentOpen.opens.format('H:mm') + ' - ' + events[j].currentOpen.closes.format('H:mm') + ' ' + events[j].title + '</a></td></tr>';
      }
      content += '</table>';
      $('.default-container .main-content').html(content);
      $('.default-container .content-title').text(moment(date, 'D.M.').format('dddd D.M.'));
      $('.events-container').hide();
      $('.map-container').hide();
      $('.default-container').show();
    }
  }
};

app.initialize();
