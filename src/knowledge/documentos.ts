import type { DocumentoFiscal, Procedencia } from "./types";

const p = (fonteId: string, documento: string): Procedencia => ({
  status: "pendente",
  fonteId,
  documento,
  vigencia: { observacao: "Vigência não registrada neste ambiente." },
});

export const documentos: DocumentoFiscal[] = [
  {
    id: "nfe55",
    sigla: "NF-e",
    modelo: "55",
    nome: "Nota Fiscal Eletrônica",
    rota: "/nfe",
    oQueE:
      "Documento fiscal eletrônico que registra uma operação com mercadorias entre estabelecimentos, autorizado pela administração tributária antes da circulação.",
    porQueExiste:
      "Substitui a nota em papel, permite conferência prévia pelo fisco e cria um registro eletrônico único, identificado por chave de acesso, para toda a cadeia.",
    quandoUsar: [
      "Operação com mercadoria entre pessoas jurídicas",
      "Venda interestadual",
      "Devolução, transferência, remessa e retorno de mercadoria",
      "Operações que precisam acompanhar o transporte da carga",
    ],
    quandoNaoUsar: [
      "Venda presencial a consumidor final no varejo, quando o estado admite NFC-e",
      "Prestação de serviço sujeita ao ISS — nesse caso é NFS-e",
      "Prestação de serviço de transporte — nesse caso é CT-e",
    ],
    participantes: [
      { papel: "Emitente", descricao: "Quem realiza a operação e emite o documento." },
      { papel: "Destinatário", descricao: "Quem recebe a mercadoria." },
      { papel: "Transportador", descricao: "Quem executa o transporte, quando informado." },
      { papel: "Fisco", descricao: "Autoriza, rejeita ou denega o documento." },
    ],
    fluxo: [
      "Cadastro de emitente, destinatário e produtos",
      "Escolha da operação e do CFOP",
      "Definição da tributação por item",
      "Cálculo dos tributos e dos totais",
      "Geração e assinatura do XML",
      "Validação de esquema e de regras",
      "Transmissão e autorização",
      "Eventos posteriores (cancelamento, carta de correção, manifestação)",
    ],
    eventos: [
      "Cancelamento",
      "Carta de correção",
      "Manifestação do destinatário",
      "Inutilização de numeração",
    ],
    procedencia: p("moc-nfe", "NF-e"),
    pendencias: ["Registrar a versão do MOC usada como referência."],
  },
  {
    id: "nfce65",
    sigla: "NFC-e",
    modelo: "65",
    nome: "Nota Fiscal de Consumidor Eletrônica",
    rota: "/nfce",
    oQueE:
      "Documento eletrônico para venda presencial a consumidor final, com representação simplificada e QR Code para consulta.",
    porQueExiste:
      "Dá ao varejo um documento eletrônico ágil no ponto de venda, com validação pelo consumidor por QR Code.",
    quandoUsar: [
      "Venda presencial no varejo a consumidor final",
      "Operações de PDV com entrega imediata ao comprador",
    ],
    quandoNaoUsar: [
      "Operação interestadual com mercadoria",
      "Venda a contribuinte que precisa de crédito com NF-e",
      "Situações em que a UF não autoriza NFC-e para o caso",
    ],
    participantes: [
      { papel: "Emitente", descricao: "Estabelecimento varejista." },
      { papel: "Consumidor", descricao: "Identificado ou não, conforme a regra da UF." },
    ],
    fluxo: [
      "Registro dos itens no caixa",
      "Formas de pagamento e troco",
      "Identificação opcional do consumidor",
      "Geração e assinatura do XML",
      "Autorização em linha ou entrada em contingência",
      "Impressão do DANFE NFC-e com QR Code",
    ],
    eventos: ["Cancelamento", "Inutilização de numeração"],
    procedencia: p("mo-nfce", "NFC-e"),
    pendencias: [
      "Modalidades e prazos de contingência variam por UF — não tratar como regra universal.",
      "Regras de identificação obrigatória do consumidor dependem da UF e do valor.",
    ],
  },
  {
    id: "nfse",
    sigla: "NFS-e",
    nome: "Nota Fiscal de Serviço Eletrônica",
    rota: "/nfse",
    oQueE:
      "Documento eletrônico que registra prestação de serviço sujeita ao ISS, com padrão nacional e variações municipais.",
    porQueExiste:
      "O ISS é tributo municipal: cada município regula a emissão. O padrão nacional busca uniformizar o leiaute sem eliminar as particularidades locais.",
    quandoUsar: [
      "Prestação de serviço constante da lista de serviços",
      "Serviço tomado por pessoa física ou jurídica sujeito ao ISS",
    ],
    quandoNaoUsar: [
      "Circulação de mercadoria — nesse caso é NF-e ou NFC-e",
      "Serviço de transporte intermunicipal ou interestadual de carga — nesse caso é CT-e",
    ],
    participantes: [
      { papel: "Prestador", descricao: "Quem executa o serviço e emite a nota." },
      { papel: "Tomador", descricao: "Quem contrata e recebe o serviço." },
      { papel: "Município", descricao: "Define o padrão, o código do serviço e a alíquota." },
      { papel: "Intermediário", descricao: "Quando existe, participa da relação de prestação." },
    ],
    fluxo: [
      "Identificação do prestador e do tomador",
      "Escolha do item da lista e do código municipal do serviço",
      "Definição do local de incidência do ISS",
      "Cálculo do ISS, deduções e retenções",
      "Envio ao município ou ao padrão nacional",
      "Retorno com número, código de verificação e link de consulta",
    ],
    eventos: ["Cancelamento", "Substituição", "Carta de correção — quando o município permite"],
    procedencia: p("nfse-nacional", "NFS-e"),
    pendencias: [
      "Cada município pode ter campos, códigos e regras próprios.",
      "Local de incidência do ISS depende do tipo de serviço — regra a confirmar por item da lista.",
    ],
  },
  {
    id: "cte57",
    sigla: "CT-e",
    modelo: "57",
    nome: "Conhecimento de Transporte Eletrônico",
    rota: "/cte",
    oQueE:
      "Documento eletrônico que registra a prestação de serviço de transporte de cargas e vincula os documentos da carga transportada.",
    porQueExiste:
      "Formaliza a prestação de transporte, define quem paga o frete e liga a carga (NF-e) ao serviço prestado.",
    quandoUsar: [
      "Prestação de serviço de transporte de carga",
      "Transporte intermunicipal e interestadual",
      "Subcontratação, redespacho e complemento de valores",
    ],
    quandoNaoUsar: [
      "Transporte de pessoas ou de valores — nesse caso é CT-e OS",
      "Transporte de carga própria sem prestação de serviço",
    ],
    participantes: [
      { papel: "Emitente", descricao: "Transportador que presta o serviço." },
      { papel: "Remetente", descricao: "Quem entrega a carga para transporte." },
      { papel: "Expedidor", descricao: "Quem entrega a carga ao transportador em redespacho." },
      { papel: "Recebedor", descricao: "Quem recebe a carga do transportador." },
      { papel: "Destinatário", descricao: "Destino final da carga." },
      { papel: "Tomador", descricao: "Quem contrata e paga o serviço de transporte." },
    ],
    fluxo: [
      "Identificação das partes e do tomador",
      "Vínculo das NF-e transportadas",
      "Composição do frete e dos componentes de valor",
      "Tributação da prestação",
      "Geração, assinatura e autorização",
      "Uso em MDF-e e eventos posteriores",
    ],
    eventos: ["Cancelamento", "Carta de correção", "Anulação", "Substituição", "Prestação em desacordo"],
    procedencia: p("mo-cte", "CT-e"),
  },
  {
    id: "cteos67",
    sigla: "CT-e OS",
    modelo: "67",
    nome: "Conhecimento de Transporte Eletrônico para Outros Serviços",
    rota: "/cte-os",
    oQueE:
      "Documento eletrônico para prestações de transporte que não são de carga convencional: pessoas, valores e excesso de bagagem.",
    porQueExiste:
      "Essas prestações não têm carga com NF-e vinculada; precisam de um leiaute próprio, sem os grupos de documentos transportados do CT-e.",
    quandoUsar: [
      "Transporte rodoviário de pessoas",
      "Transporte de valores em malotes",
      "Excesso de bagagem",
    ],
    quandoNaoUsar: ["Transporte de carga com documentos fiscais vinculados — nesse caso é CT-e 57"],
    participantes: [
      { papel: "Emitente", descricao: "Transportador prestador do serviço." },
      { papel: "Tomador", descricao: "Contratante do serviço." },
      { papel: "Passageiro / contratante do malote", descricao: "Beneficiário da prestação." },
    ],
    fluxo: [
      "Escolha da modalidade (pessoas, valores, excesso de bagagem)",
      "Identificação do tomador",
      "Detalhamento da prestação",
      "Tributação e totais",
      "Geração, assinatura e autorização",
    ],
    eventos: ["Cancelamento", "Carta de correção"],
    procedencia: p("mo-cte", "CT-e OS"),
  },
  {
    id: "mdfe58",
    sigla: "MDF-e",
    modelo: "58",
    nome: "Manifesto Eletrônico de Documentos Fiscais",
    rota: "/mdfe",
    oQueE:
      "Documento que agrupa os documentos fiscais de uma mesma viagem, com veículo, condutor e percurso, e precisa ser encerrado ao fim do trajeto.",
    porQueExiste:
      "Permite ao fisco acompanhar a viagem como um todo, e não documento a documento, e dá base para fiscalização em trânsito.",
    quandoUsar: [
      "Transporte com mais de um documento fiscal na mesma viagem",
      "Trânsito interestadual de carga sob responsabilidade do transportador",
    ],
    quandoNaoUsar: ["Quando a operação não configura viagem sujeita a manifesto na UF envolvida"],
    participantes: [
      { papel: "Emitente", descricao: "Transportador ou embarcador, conforme o caso." },
      { papel: "Condutor", descricao: "Motorista responsável pela viagem." },
      { papel: "Veículo", descricao: "Tração e reboques utilizados." },
    ],
    fluxo: [
      "Seleção dos CT-e e NF-e da viagem",
      "Veículo, reboques e condutor",
      "UF de carregamento, percurso e descarregamento",
      "Totais de carga",
      "Autorização",
      "Encerramento ao fim da viagem",
    ],
    eventos: ["Cancelamento", "Encerramento", "Inclusão de condutor", "Inclusão de DF-e"],
    procedencia: p("mo-mdfe", "MDF-e"),
    pendencias: ["Prazos e obrigatoriedade de encerramento dependem da UF e da versão do manual."],
  },
  {
    id: "eventos",
    sigla: "Manifestação",
    nome: "Manifestação do destinatário",
    rota: "/",
    oQueE:
      "Conjunto de eventos em que o destinatário registra sua posição sobre uma NF-e emitida contra o seu CNPJ.",
    porQueExiste:
      "Dá ao destinatário um canal formal para reconhecer, recusar ou desconhecer operações, reduzindo uso indevido do seu cadastro.",
    quandoUsar: [
      "Nota recebida que precisa de reconhecimento da operação",
      "Nota que não corresponde a nenhuma operação da empresa",
      "Operação que foi cancelada de fato entre as partes",
    ],
    quandoNaoUsar: ["Correção de dados do documento — isso é carta de correção do emitente"],
    participantes: [
      { papel: "Destinatário", descricao: "Quem manifesta." },
      { papel: "Emitente", descricao: "Quem emitiu o documento manifestado." },
      { papel: "Fisco", descricao: "Registra o evento e devolve protocolo." },
    ],
    fluxo: [
      "NF-e recebida aparece na distribuição",
      "Destinatário escolhe o tipo de manifestação",
      "Evento é assinado e transmitido",
      "Protocolo é devolvido e armazenado",
      "Consequência: acesso ao XML e efeitos sobre a operação",
    ],
    eventos: [
      "Ciência da emissão",
      "Confirmação da operação",
      "Desconhecimento da operação",
      "Operação não realizada",
    ],
    procedencia: p("moc-nfe", "Eventos de manifestação"),
    pendencias: [
      "Códigos oficiais de cada evento e prazos de manifestação não foram registrados aqui.",
    ],
  },
];

export const documentoById = new Map(documentos.map((d) => [d.id, d]));
