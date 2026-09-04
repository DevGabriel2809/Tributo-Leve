# SEO, Search Console e Analytics

## Search Console

1. crie/abra a propriedade `https://tributoleve.com.br`;
2. use verificação por DNS ou meta tag;
3. se usar meta tag, defina `VITE_GOOGLE_SITE_VERIFICATION` no Netlify e publique novamente;
4. envie `https://tributoleve.com.br/sitemap.xml`;
5. solicite indexação das páginas principais após o deploy.

## Google Analytics 4

Defina `VITE_GA_MEASUREMENT_ID=G-...`. O script do GA não é carregado até o visitante autorizar Analytics no centro LGPD. O painel do Google Analytics fornece aquisição/origem, enquanto o Admin do Tributo Leve usa presença própria para mostrar contas autenticadas online.

Nenhum e-mail, CPF, CNPJ ou outro identificador pessoal deve ser enviado ao GA.

## Google Business Profile

Só crie um Perfil da Empresa se a operação for elegível para atendimento presencial/área de serviço. Um SaaS exclusivamente online não deve inventar endereço ou atendimento físico para obter perfil.

## Arquivos

- `/robots.txt`
- `/sitemap.xml`
- `/llms.txt`
- `/.well-known/security.txt`

`llms.txt` é uma descrição legível por sistemas automatizados; não garante ranking ou recomendação por mecanismos de IA.
