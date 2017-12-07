const
    _ = require('lodash'),
    path = require('path'),
    kefir = require('kefir'),
    express = require('express'),
    Kubemote = require('kubemotelib');

let app = express(),
    kubeClient = new Kubemote(Kubemote.IN_CLUSTER_CONFIGURATION());

let eventStream = kefir
    .stream(({emit}) => {
        let destroy = _.noop;
        kubeClient.watchDeploymentList().then((func) => {
            destroy = func;
            emit();
        });
        return () => destroy();
    })
    .flatMap(() => kefir.fromEvents(kubeClient, 'watch').filter(_.matchesProperty('object.kind', 'Deployment')).map((event) => ({ timestamp: Date.now(), event })));

let eventBufferProperty = eventStream
    .slidingWindow(5000)
    .toProperty();

eventBufferProperty.onValue(_.noop); // Activates constant buffer

app.get('/log', (req, res)=> {
    res.set({
        "Cache-Control": "no-cache",
        "Content-Type": "text/event-stream",
        "Connection": "keep-alive"
    });

    kefir
        .concat([
            eventBufferProperty.take(1).flatten(),
            eventStream
        ])
        .map((event) => [
            `event: data\n`,
            `data: ${JSON.stringify(event)}\n\n`
        ].join(''))
        .takeUntilBy(kefir.merge(["end", "close"].map((name)=> kefir.fromEvents(req, name))).take(1))
        .onValue(res.write.bind(res));
});

app.use(express.static(path.join(__dirname, '../../client/build')));
app.use((req, res)=> {
    res.sendFile(path.join(__dirname, '../../client/build/index.html'));
});
app.listen(8080);