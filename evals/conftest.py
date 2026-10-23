import pytest


def pytest_addoption(parser):
    parser.addoption("--policy", default="marginal_sql", help="policy under test (marginal_sql, marginal_sql_v2, agent, ...)")
    parser.addoption("--weeks", type=int, default=26)


@pytest.fixture(scope="session")
def policy(request):
    return request.config.getoption("--policy")


@pytest.fixture(scope="session")
def weeks(request):
    return request.config.getoption("--weeks")
