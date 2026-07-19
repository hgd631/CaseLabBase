FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src


COPY CaseLabBase.sln ./
COPY CaseLabBase.API/*.csproj ./CaseLabBase.API/
COPY CaseLabBase.BLL/*.csproj ./CaseLabBase.BLL/
COPY CaseLabBase.DAL/*.csproj ./CaseLabBase.DAL/
COPY CaseLabBase.Web/*.csproj ./CaseLabBase.Web/

RUN dotnet restore


COPY . .
RUN dotnet publish CaseLabBase.Web/CaseLabBase.Web.csproj -c Release -o /app/out


FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/out .

EXPOSE 80
EXPOSE 443

ENTRYPOINT ["dotnet", "CaseLabBase.Web.dll"]